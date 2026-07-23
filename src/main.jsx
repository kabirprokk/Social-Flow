import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight, Check, CheckCircle2, ChevronDown, CircleUserRound,
  CloudUpload, Eye, EyeOff, FileImage, FileVideo, Hash,
  KeyRound, LayoutGrid, Menu, MoreHorizontal, Plus, Send, Settings,
  Sparkles, Trash2, Upload, WandSparkles, X, Zap
} from 'lucide-react';
import './styles.css';

const Youtube = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>;
const Instagram = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>;

const ACCOUNTS = [
  { id: 'youtube', name: 'YouTube', handle: 'Social Flow Studio', icon: Youtube, tone: 'red', audience: 'Public' },
  { id: 'instagram', name: 'Instagram', handle: '@socialflow', icon: Instagram, tone: 'pink', audience: 'Everyone' },
  { id: 'x', name: 'X', handle: '@socialflowhq', icon: X, tone: 'black', audience: 'Everyone' },
  { id: 'facebook', name: 'Facebook', handle: 'Social Flow', icon: CircleUserRound, tone: 'blue', audience: 'Public' },
];

function Brand() {
  return <div className="brand"><div className="brand-mark"><span /><span /><span /></div><b>Social Flow</b></div>;
}

function PlatformIcon({ account, size = 18 }) {
  const Icon = account.icon;
  return <span className={`platform-icon ${account.tone}`}><Icon size={size} strokeWidth={2.2} /></span>;
}

function App() {
  const [view, setView] = useState('create');
  const [selected, setSelected] = useState(['youtube', 'instagram', 'x']);
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [caption, setCaption] = useState("A little reminder: the best ideas don't need to be loud. They just need room to grow. 🌿");
  const [title, setTitle] = useState('Make space for better ideas');
  const [hashtags, setHashtags] = useState('#creativity #mindset #growth');
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState({});
  const [aiKey, setAiKey] = useState('');
  const [savedKey, setSavedKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    if (!publishing) return;
    const ids = selected;
    setResults(Object.fromEntries(ids.map(id => [id, { progress: 8, state: 'uploading' }])));
    const timer = setInterval(() => {
      setResults(current => {
        let done = true;
        const next = { ...current };
        ids.forEach((id, i) => {
          const item = next[id] || { progress: 0, state: 'uploading' };
          if (item.progress < 100) {
            done = false;
            const progress = Math.min(100, item.progress + 9 + i * 2);
            next[id] = { progress, state: progress === 100 ? 'published' : 'uploading' };
          }
        });
        if (done) { clearInterval(timer); setPublishing(false); }
        return next;
      });
    }, 320);
    return () => clearInterval(timer);
  }, [publishing]);

  const toggle = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const loadFile = f => f && setFile({ name: f.name, size: `${(f.size / 1024 / 1024).toFixed(1)} MB`, type: f.type, url: f.type.startsWith('image') ? URL.createObjectURL(f) : null });
  const improve = () => {
    if (!savedKey) return;
    setCaption("Give your best ideas the space they deserve. Quiet the noise, stay curious, and let meaningful work take root. 🌿");
    setHashtags('#CreativeGrowth #MindfulWork #IdeasThatMatter #StayCurious');
    setTitle('Give your best ideas room to grow');
  };

  const nav = [
    { id: 'create', label: 'Create post', icon: Plus },
    { id: 'accounts', label: 'Accounts', icon: LayoutGrid },
    { id: 'ai', label: 'AI settings', icon: Sparkles },
  ];

  return (
    <div className="app-shell">
      <aside className={mobileNav ? 'sidebar open' : 'sidebar'}>
        <div className="side-top"><Brand /><button className="close-nav" onClick={() => setMobileNav(false)}><X size={19}/></button></div>
        <nav>
          <p className="nav-label">Workspace</p>
          {nav.map(item => <button key={item.id} className={view === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { setView(item.id); setMobileNav(false); }}><item.icon size={18}/><span>{item.label}</span>{item.id === 'accounts' && <em>4</em>}</button>)}
        </nav>
        <div className="sidebar-foot">
          <div className="pro-card"><div className="mini-spark"><Zap size={15}/></div><b>Posting made simple.</b><p>Four platforms. One calm workspace.</p></div>
          <button className="user-row"><span className="avatar">Y</span><span><b>Yasin</b><small>Personal workspace</small></span><MoreHorizontal size={18}/></button>
        </div>
      </aside>
      {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}

      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)}><Menu size={21}/></button>
          <div><span className="eyebrow">SOCIAL FLOW</span><h1>{view === 'create' ? 'Create post' : view === 'accounts' ? 'Connected accounts' : 'AI settings'}</h1></div>
          <div className="top-actions"><span className="status-dot"><i /> All systems operational</span><button className="help">?</button></div>
        </header>

        {view === 'create' && (
          <div className="page create-page">
            <div className="intro"><div><h2>Share something <em>worth seeing.</em></h2><p>Create once, publish everywhere—without the busywork.</p></div><span className="draft-state"><Check size={14}/> Draft saved</span></div>
            <div className="composer-grid">
              <section className="card compose-card">
                <div className="section-head"><span className="step">1</span><div><h3>Choose destinations</h3><p>Select where this post should go</p></div><button className="text-button" onClick={() => setSelected(selected.length === 4 ? [] : ACCOUNTS.map(a => a.id))}>{selected.length === 4 ? 'Clear' : 'Select all'}</button></div>
                <div className="account-grid">
                  {ACCOUNTS.map(a => <button key={a.id} className={selected.includes(a.id) ? 'account-option selected' : 'account-option'} onClick={() => toggle(a.id)}><PlatformIcon account={a}/><span><b>{a.name}</b><small>{a.handle}</small></span><i className="check">{selected.includes(a.id) && <Check size={13}/>}</i></button>)}
                </div>

                <div className="divider" />
                <div className="section-head"><span className="step">2</span><div><h3>Add your content</h3><p>Upload an image or video</p></div></div>
                {!file ? <div className={drag ? 'dropzone dragging' : 'dropzone'} onDragOver={e => {e.preventDefault(); setDrag(true)}} onDragLeave={() => setDrag(false)} onDrop={e => {e.preventDefault(); setDrag(false); loadFile(e.dataTransfer.files[0])}} onClick={() => inputRef.current.click()}>
                  <input ref={inputRef} type="file" accept="image/*,video/*" hidden onChange={e => loadFile(e.target.files[0])}/>
                  <div className="upload-icon"><CloudUpload size={25}/></div><b>Drop your media here</b><p>or <span>browse your files</span></p><small>Images up to 20 MB · Videos up to 2 GB</small>
                </div> : <div className="file-preview">
                  <div className="preview-thumb">{file.url ? <img src={file.url} alt="Upload preview"/> : <FileVideo size={30}/>}</div>
                  <div><b>{file.name}</b><small>{file.size} · Ready to publish</small></div><span className="ready"><Check size={13}/> Ready</span><button onClick={() => setFile(null)}><Trash2 size={17}/></button>
                </div>}

                <div className="divider" />
                <div className="section-head"><span className="step">3</span><div><h3>Polish your post</h3><p>Fine-tune the details</p></div>{savedKey && <button className="ai-button" onClick={improve}><WandSparkles size={15}/> Improve with AI</button>}</div>
                <label className="field"><span>Title <small>YouTube & Facebook</small></span><input value={title} onChange={e => setTitle(e.target.value)} maxLength={100}/><i>{title.length}/100</i></label>
                <label className="field"><span>Caption / description</span><textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={2200}/><i>{caption.length}/2,200</i></label>
                <label className="field hashtag-field"><span>Hashtags</span><Hash size={16}/><input value={hashtags.replaceAll('#','')} onChange={e => setHashtags(e.target.value.split(' ').map(x => x ? `#${x.replace('#','')}` : '').join(' '))}/></label>
                <div className="settings-row"><button><Eye size={16}/><span><small>Audience</small><b>Public</b></span><ChevronDown size={15}/></button><button><FileImage size={16}/><span><small>Thumbnail</small><b>Auto-generated</b></span><ChevronDown size={15}/></button></div>
              </section>

              <aside className="publish-panel">
                <div className="summary card"><div className="summary-head"><div><h3>Ready to publish?</h3><p>{selected.length} destination{selected.length !== 1 ? 's' : ''} selected</p></div><Send size={20}/></div>
                  <div className="destination-list">{selected.length ? ACCOUNTS.filter(a => selected.includes(a.id)).map(a => {
                    const r = results[a.id];
                    return <div className="destination" key={a.id}><PlatformIcon account={a} size={15}/><div><b>{a.name}</b>{r && <span className="progress-track"><i style={{width: `${r.progress}%`}} /></span>}</div><small className={r?.state || ''}>{r ? (r.state === 'published' ? 'Published' : `${r.progress}%`) : 'Ready'}</small></div>
                  }) : <div className="empty-state">Choose at least one destination</div>}</div>
                  <button className="publish-button" disabled={!selected.length || publishing} onClick={() => setPublishing(true)}>{publishing ? <><span className="spinner"/> Publishing…</> : <><Upload size={17}/> Publish everywhere</>}</button>
                  <p className="secure-note"><CheckCircle2 size={13}/> Posted securely to each platform</p>
                </div>
                <div className="tip-card"><Sparkles size={16}/><div><b>{savedKey ? 'AI assistance is on' : 'Make every word count'}</b><p>{savedKey ? 'Use AI to refine your title, caption, and hashtags.' : 'Connect your AI key for smarter captions and hashtag suggestions.'}</p>{!savedKey && <button onClick={() => setView('ai')}>Set up AI <ArrowUpRight size={13}/></button>}</div></div>
              </aside>
            </div>
          </div>
        )}

        {view === 'accounts' && <div className="page narrow-page"><div className="settings-intro"><span className="page-icon"><LayoutGrid/></span><h2>Your connected accounts</h2><p>Connect and manage the places where you publish.</p></div><div className="account-list card">{ACCOUNTS.map(a => <div className="account-row" key={a.id}><PlatformIcon account={a} size={20}/><div><b>{a.name}</b><small>{a.handle}</small></div><span className="connected"><i/> Connected</span><button>Manage <ChevronDown size={14}/></button></div>)}<button className="connect-new"><Plus size={17}/> Connect another account</button></div><div className="notice"><KeyRound size={17}/><p><b>Secure connections</b><br/>Social Flow uses OAuth. Your platform passwords are never seen or stored.</p></div></div>}

        {view === 'ai' && <div className="page narrow-page"><div className="settings-intro"><span className="page-icon ai"><Sparkles/></span><span className={savedKey ? 'ai-status on' : 'ai-status'}><i/>{savedKey ? 'AI enabled' : 'AI disabled'}</span><h2>Optional AI assistance</h2><p>Bring your own API key for better captions, titles, and hashtags. Social Flow works perfectly without it.</p></div><div className="ai-settings card"><label className="field"><span>Provider</span><div className="select-look">OpenAI compatible <ChevronDown size={16}/></div></label><label className="field"><span>API key</span><div className="key-input"><KeyRound size={16}/><input type={showKey ? 'text' : 'password'} placeholder="Paste your API key" value={aiKey} onChange={e => setAiKey(e.target.value)}/><button onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label><p className="privacy-copy">Your key is encrypted before storage and is only used for requests you initiate.</p><button className="save-button" disabled={!aiKey} onClick={() => setSavedKey(true)}>{savedKey ? <><Check size={16}/> Settings saved</> : 'Save AI settings'}</button></div><div className="capabilities"><p>When enabled, AI can help with</p><div><span><Check/> Caption improvement</span><span><Check/> Hashtag suggestions</span><span><Check/> Title suggestions</span><span><Check/> Grammar correction</span></div></div></div>}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
