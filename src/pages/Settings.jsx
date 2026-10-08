import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useProject } from '../contexts/ProjectContext';
import { Save, Image as ImageIcon } from 'lucide-react';

export default function Settings() {
  const { activeProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    auth_name: '',
    auth_branch: '',
    auth_department: '',
    auth_signature_url: '',
    watermark_url: ''
  });
  
  const [signatureFile, setSignatureFile] = useState(null);
  const [preview, setPreview] = useState('');

  const [watermarkFile, setWatermarkFile] = useState(null);
  const [watermarkPreview, setWatermarkPreview] = useState('');

  useEffect(() => {
    fetchSettings();
  }, [activeProject]);

  const fetchSettings = async () => {
    if (!activeProject) return;
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('project_id', activeProject.id)
        .single();
      
      if (data) {
        setSettings(data);
        if (data.auth_signature_url) {
          const { data: urlData } = await supabase.storage
            .from('tenant-documents')
            .createSignedUrl(data.auth_signature_url, 3600);
          if (urlData) setPreview(urlData.signedUrl);
        }
        if (data.watermark_url) {
          const { data: urlData } = await supabase.storage
            .from('tenant-documents')
            .createSignedUrl(data.watermark_url, 3600);
          if (urlData) setWatermarkPreview(urlData.signedUrl);
        }
      }
    } catch (err) {
      console.log('No settings found or error fetching:', err);
    }
  };

  const handleFileChange = (e, setFile, setPrev) => {
    const file = e.target.files[0];
    if (file) {
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPrev(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!activeProject) return;
    setLoading(true);

    try {
      let signaturePath = settings.auth_signature_url;
      let watermarkPath = settings.watermark_url;

      if (signatureFile) {
        const fileExt = signatureFile.name.split('.').pop();
        const fileName = `signature_${activeProject.id}_${Date.now()}.${fileExt}`;
        const filePath = `settings/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('tenant-documents')
          .upload(filePath, signatureFile, { upsert: true });
        if (uploadError) throw uploadError;
        signaturePath = filePath;
      }

      if (watermarkFile) {
        const fileExt = watermarkFile.name.split('.').pop();
        const fileName = `watermark_${activeProject.id}_${Date.now()}.${fileExt}`;
        const filePath = `settings/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('tenant-documents')
          .upload(filePath, watermarkFile, { upsert: true });
        if (uploadError) throw uploadError;
        watermarkPath = filePath;
      }

      const upsertData = {
        project_id: activeProject.id,
        auth_name: settings.auth_name,
        auth_branch: settings.auth_branch,
        auth_department: settings.auth_department,
        auth_signature_url: signaturePath,
        watermark_url: watermarkPath,
        updated_at: new Date().toISOString()
      };

      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('project_id', activeProject.id)
        .single();

      if (existing) {
        await supabase
          .from('app_settings')
          .update(upsertData)
          .eq('project_id', activeProject.id);
      } else {
        await supabase
          .from('app_settings')
          .insert([upsertData]);
      }

      alert('Settings saved successfully!');
      fetchSettings();
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings. Make sure you ran the SQL migration to create the table.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Receipt Settings</h1>
          <p className="page-subtitle">Configure your logo and signature for official receipts.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Receipt Logo</label>
            <div style={{ 
              border: '2px dashed var(--color-border)', 
              borderRadius: '8px', 
              padding: '2rem', 
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              position: 'relative'
            }}>
              {watermarkPreview ? (
                <div>
                  <img src={watermarkPreview} alt="Logo Preview" style={{ maxHeight: '100px', objectFit: 'contain' }} />
                  <p style={{ margin: '1rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    Click to change logo
                  </p>
                </div>
              ) : (
                <div style={{ color: 'var(--color-text-muted)' }}>
                  <ImageIcon size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>Click to upload logo</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={e => handleFileChange(e, setWatermarkFile, setWatermarkPreview)}
                style={{
                  position: 'absolute',
                  top: 0, left: 0, width: '100%', height: '100%',
                  opacity: 0, cursor: 'pointer'
                }}
              />
            </div>
          </div>

          <hr style={{ margin: '2rem 0', borderColor: 'var(--color-border)' }} />

          <div className="form-group">
            <label className="form-label">Authorized Person Name</label>
            <input
              type="text"
              className="form-control"
              value={settings.auth_name || ''}
              onChange={e => setSettings({ ...settings, auth_name: e.target.value })}
              placeholder="e.g. John Doe"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Branch</label>
            <input
              type="text"
              className="form-control"
              value={settings.auth_branch || ''}
              onChange={e => setSettings({ ...settings, auth_branch: e.target.value })}
              placeholder="e.g. Main Branch"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Department</label>
            <input
              type="text"
              className="form-control"
              value={settings.auth_department || ''}
              onChange={e => setSettings({ ...settings, auth_department: e.target.value })}
              placeholder="e.g. Finance & Accounts"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Signature Image (Transparent PNG recommended)</label>
            <div style={{ 
              border: '2px dashed var(--color-border)', 
              borderRadius: '8px', 
              padding: '2rem', 
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              position: 'relative'
            }}>
              {preview ? (
                <div>
                  <img src={preview} alt="Signature Preview" style={{ maxHeight: '100px', objectFit: 'contain', mixBlendMode: 'multiply', filter: 'grayscale(100%) contrast(300%) brightness(150%)' }} />
                  <p style={{ margin: '1rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    Click to change signature
                  </p>
                </div>
              ) : (
                <div style={{ color: 'var(--color-text-muted)' }}>
                  <ImageIcon size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>Click to upload signature</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={e => handleFileChange(e, setSignatureFile, setPreview)}
                style={{
                  position: 'absolute',
                  top: 0, left: 0, width: '100%', height: '100%',
                  opacity: 0, cursor: 'pointer'
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              <Save size={18} />
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
