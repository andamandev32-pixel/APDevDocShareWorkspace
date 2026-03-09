// App State
let projects = [];
let currentPreviewId = null;

// Backend API URL (Ensure this matches the uploaded location)
const API_URL = 'api.php';

// DOM Elements
const grid = document.getElementById('projectGrid');
const addBtn = document.getElementById('addProjectBtn');
const addModal = document.getElementById('addModal');
const pinModal = document.getElementById('pinModal');
const closeBtns = document.querySelectorAll('.close-btn, [data-modal]');

// Form Elements
const addForm = document.getElementById('addProjectForm');
const pType = document.getElementById('pType');
const bundleInputs = document.getElementById('bundleInputs');
const jsxInputs = document.getElementById('jsxInputs');

// Share Modal
const shareModal = document.getElementById('shareModal');
const shareLinkInput = document.getElementById('shareLinkInput');
const copyShareBtn = document.getElementById('copyShareBtn');

// PIN Elements
const pinInput = document.getElementById('verifyPin');
const pinDots = document.querySelectorAll('.pin-dot');
const pinError = document.getElementById('pinError');

// Preview Elements (Removed modal elements, now using new tab)

// Initialization
async function init() {
    await fetchProjects();
    setupEventListeners();
    checkShareLink();
}

function checkShareLink() {
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
        try {
            const dataStr = atob(hash.replace('#share=', ''));
            const sharedProj = JSON.parse(decodeURIComponent(dataStr));

            // Clean hash to prevent repeated opens on refresh
            window.history.replaceState(null, null, ' ');

            handlePreview(sharedProj);
        } catch (e) {
            console.error('Failed to parse shared link', e);
            alert('This share link is invalid or corrupted.');
        }
    }
}

async function fetchProjects() {
    try {
        grid.innerHTML = '<div class="empty-state"><p>Loading projects from database...</p></div>';
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        // Handle case where DB might be empty or table missing
        if (Array.isArray(data)) {
            projects = data;
        } else {
            console.error("API Error:", data.error);
            projects = [];
        }
    } catch (error) {
        console.error('Error fetching projects:', error);
        projects = [];
    }
    renderGrid();
}

function renderGrid() {
    grid.innerHTML = '';

    if (projects.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                <h3>No Projects Yet</h3>
                <p>Click "Add Summary" to create your first protected document.</p>
            </div>
        `;
        return;
    }

    // Sort by favorite first, then newest
    const sorted = [...projects].sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    sorted.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <span class="card-type">${p.type === 'bundle' ? 'HTML/CSS/JS' : 'JSX'}</span>
                <div class="card-actions">
                    <button class="icon-btn star-btn ${p.favorite ? 'active' : ''}" onclick="toggleFavorite('${p.id}', event)" title="Favorite">★</button>
                    <button class="icon-btn share-btn" onclick="shareProject('${p.id}', event)" title="Share Link">🔗</button>
                    <button class="icon-btn edit-btn" onclick="editProject('${p.id}', event)" title="Edit">✏️</button>
                    <button class="icon-btn delete-btn" onclick="deleteProject('${p.id}', event)" title="Delete">🗑️</button>
                </div>
            </div>
            <h3 class="card-title">${escapeHTML(p.title)}</h3>
            <p class="card-desc">${escapeHTML(p.desc)}</p>
            <div class="card-footer">
                <div class="card-lock" style="color: ${p.pin ? '#f59e0b' : '#10b981'}">
                    ${p.pin ?
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> PIN Protected'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg> Public (No PIN)'
            }
                </div>
                <span style="margin-left:auto">${new Date(p.createdAt).toLocaleDateString()}</span>
            </div>
        `;
        card.addEventListener('click', () => initiatePreview(p.id));
        grid.appendChild(card);
    });
}

// Event Listeners
function setupEventListeners() {
    // Add Modal toggle (Reset to Add mode)
    addBtn.addEventListener('click', () => {
        addForm.reset();
        document.getElementById('addModal').removeAttribute('data-edit-id');
        document.querySelector('#addModal h2').textContent = 'Add New Summary';
        openModal(addModal);
    });

    // Close Modals
    closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const modalId = btn.getAttribute('data-modal');
            const modal = document.getElementById(modalId) || btn.closest('.modal');
            closeModal(modal);
        });
    });

    // Toggle Input Types in Add Form
    pType.addEventListener('change', (e) => {
        if (e.target.value === 'bundle') {
            bundleInputs.style.display = 'block';
            jsxInputs.style.display = 'none';
        } else {
            bundleInputs.style.display = 'none';
            jsxInputs.style.display = 'block';
        }
    });

    // Utility to read file as text
    const readFileAsText = (file) => {
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve('');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    };

    // Form Submit
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.querySelector('button[form="addProjectForm"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
        }

        try {
            const type = pType.value;
            const editId = addModal.getAttribute('data-edit-id');
            const isEdit = !!editId;
            const existingProject = isEdit ? projects.find(p => p.id === editId) : null;

            const newProject = {
                id: isEdit ? editId : Date.now().toString(),
                title: document.getElementById('pTitle').value,
                desc: document.getElementById('pDesc').value,
                pin: document.getElementById('pPin').value.trim() || null, // Ensure empty means no PIN
                type: type,
                createdAt: isEdit ? existingProject.createdAt : new Date().toISOString(),
                favorite: isEdit ? (existingProject.favorite || false) : false
            };

            if (type === 'bundle') {
                const htmlFile = document.getElementById('iHtmlFile').files[0];
                const cssFile = document.getElementById('iCssFile').files[0];
                const jsFile = document.getElementById('iJsFile').files[0];

                newProject.html = htmlFile ? await readFileAsText(htmlFile) : (isEdit ? existingProject.html : '');
                newProject.css = cssFile ? await readFileAsText(cssFile) : (isEdit ? existingProject.css : '');
                newProject.js = jsFile ? await readFileAsText(jsFile) : (isEdit ? existingProject.js : '');
            } else {
                const jsxFile = document.getElementById('iJsxFile').files[0];
                newProject.jsx = jsxFile ? await readFileAsText(jsxFile) : (isEdit ? existingProject.jsx : '');
            }

            if (isEdit) {
                // UPDATE Request
                const response = await fetch(API_URL, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newProject)
                });

                if (response.ok) {
                    const index = projects.findIndex(p => p.id === editId);
                    projects[index] = newProject;
                } else {
                    alert('Failed to update project in database.');
                }
            } else {
                // CREATE Request
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newProject)
                });

                if (response.ok) {
                    projects.push(newProject);
                } else {
                    alert('Failed to save project to database.');
                }
            }

            // Always re-fetch from DB to ensure sync
            await fetchProjects();
            closeModal(addModal);
            addForm.reset();
        } catch (error) {
            console.error('Error reading files:', error);
            alert('Failed to read one or more files. Please try again.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Project';
            }
        }
    });

    // PIN Input Handling
    pinInput.addEventListener('input', (e) => {
        const val = e.target.value;
        // Update dots
        pinDots.forEach((dot, index) => {
            if (index < val.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
            dot.classList.remove('error');
        });
        pinError.style.display = 'none';

        if (val.length === 5) {
            verifyPin(val);
        }
    });

    // Copy Share Link
    if (copyShareBtn) {
        copyShareBtn.addEventListener('click', () => {
            shareLinkInput.select();
            document.execCommand('copy');
            const originalText = copyShareBtn.textContent;
            copyShareBtn.textContent = 'Copied!';
            setTimeout(() => { copyShareBtn.textContent = originalText; }, 2000);
        });
    }

    // Keep focus on PIN input when modal is open
    pinModal.addEventListener('click', () => {
        if (pinModal.classList.contains('active')) {
            pinInput.focus();
        }
    });
}

function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
    if (modal.id === 'pinModal') {
        pinInput.value = '';
        pinDots.forEach(dot => dot.classList.remove('filled', 'error'));
        if (pinError) pinError.style.display = 'none';
    }
}

// Keep a reference to the project currently being previewed (either from DB or share link)
let volatilePreviewProject = null;

function initiatePreview(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    handlePreview(project);
}

function handlePreview(project) {
    volatilePreviewProject = project;
    if (project.pin && project.pin.length > 0) {
        openModal(pinModal);
        setTimeout(() => pinInput.focus(), 100);
    } else {
        showPreview(project);
    }
}

function verifyPin(enteredPin) {
    const project = volatilePreviewProject;
    if (!project) return;

    if (project.pin === enteredPin) {
        // Success
        closeModal(pinModal);
        showPreview(project);
    } else {
        // Error
        pinError.style.display = 'block';
        pinDots.forEach((dot, idx) => {
            dot.classList.add('error');
            dot.classList.remove('filled');
        });
        pinInput.value = '';
        setTimeout(() => pinInput.focus(), 100);
    }
}

// Global actions for card buttons
window.toggleFavorite = async function (id, e) {
    e.stopPropagation();
    const p = projects.find(x => x.id === id);
    if (p) {
        p.favorite = !p.favorite;

        // Optimistic UI update
        renderGrid();

        try {
            // Update in DB
            await fetch(API_URL, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(p)
            });
        } catch (err) {
            console.error(err);
            // Revert on fail
            p.favorite = !p.favorite;
            renderGrid();
            alert("Database error. Could not save favorite.");
        }
    }
}

window.deleteProject = async function (id, e) {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
        try {
            const response = await fetch(`${API_URL}?id=${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                projects = projects.filter(x => x.id !== id);
                renderGrid();
            } else {
                alert("Failed to delete project from database.");
            }
        } catch (err) {
            console.error(err);
            alert("Network error.");
        }
    }
}

window.editProject = function (id, e) {
    e.stopPropagation();
    const p = projects.find(x => x.id === id);
    if (!p) return;

    // Set form mode to edit
    addModal.setAttribute('data-edit-id', id);
    document.querySelector('#addModal h2').textContent = 'Edit Summary';

    document.getElementById('pTitle').value = p.title || '';
    document.getElementById('pDesc').value = p.desc || '';
    document.getElementById('pPin').value = p.pin || '';
    document.getElementById('pType').value = p.type || 'bundle';
    pType.dispatchEvent(new Event('change'));

    openModal(addModal);
}

window.shareProject = async function (id, e) {
    e.stopPropagation();
    const p = projects.find(x => x.id === id);
    if (!p) return;

    // Dynamically calculate base url for flexible server deployments
    const baseUrl = window.location.origin + window.location.pathname;

    // Compress data by putting it in URL hash
    const jsonStr = JSON.stringify(p);
    const encoded = btoa(encodeURIComponent(jsonStr));
    const fullUrl = `${baseUrl}#share=${encoded}`;

    shareLinkInput.value = 'Generating short link...';
    openModal(shareModal);

    // Generate QR Code img via api.qrserver.com
    const qrContainer = document.getElementById('qrCodeContainer');
    if (qrContainer) {
        qrContainer.innerHTML = '<p style="margin:0; font-size:0.8rem; color:var(--text-muted)">Loading short link & QR code...</p>';
    }

    try {
        // Call TinyURL API to shorten the link
        const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(fullUrl)}`);
        if (response.ok) {
            const shortUrl = await response.text();
            shareLinkInput.value = shortUrl;

            if (qrContainer) {
                qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shortUrl)}" alt="QR Code" style="margin: 0 auto; display: block; border-radius: 8px;">`;
            }
        } else {
            throw new Error('API Error');
        }
    } catch (err) {
        console.error("Failed to shorten URL", err);
        // Fallback to long URL on fail
        shareLinkInput.value = fullUrl;
        if (qrContainer) {
            qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(fullUrl)}" alt="QR Code" style="margin: 0 auto; display: block; border-radius: 8px;">`;
        }
    }

    copyShareBtn.textContent = 'Copy Link';
}

function showPreview(project) {
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
        alert('Please allow popups for this website to view the preview.');
        return;
    }

    if (project.type === 'bundle') {
        const source = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${escapeHTML(project.title)} - Preview</title>
                <style>${project.css || ''}</style>
            </head>
            <body>
                ${project.html || ''}
                <script>
                    try {
                        ${project.js || ''}
                    } catch(e) {
                        console.error("User script error:", e);
                    }
                <\/script>
            </body>
            </html>
        `;
        previewWindow.document.open();
        previewWindow.document.write(source);
        previewWindow.document.close();
    } else {
        let code = project.jsx || '';
        code = code.replace(/import\s+.*?from\s+['"].*?['"];?/g, '');
        code = code.replace(/export\s+default\s+/g, '');
        code = code.replace(/export\s+/g, '');

        let compMatch = code.match(/(?:function|const|let|var)\s+([A-Z]\w+)/g);
        let rootComp = '';
        if (compMatch && compMatch.length > 0) {
            let lastMatch = compMatch[compMatch.length - 1];
            rootComp = lastMatch.split(/\s+/)[1];
        }

        const source = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${escapeHTML(project.title)} - Preview</title>
                <script src="https://cdn.tailwindcss.com"><\/script>
                <script src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
                <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
                <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
                <style>
                    body { margin: 0; font-family: 'Inter', sans-serif; background: #f8fafc; overflow-x: hidden; }
                    
                    /* Zoom Controls Toolbar */
                    #toolbar {
                        position: fixed;
                        top: 1rem;
                        right: 1rem;
                        background: rgba(255, 255, 255, 0.9);
                        backdrop-filter: blur(8px);
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 0.25rem;
                        display: flex;
                        gap: 0.5rem;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                        z-index: 9999;
                    }
                    .toolbar-btn {
                        background: transparent;
                        border: none;
                        width: 32px;
                        height: 32px;
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        font-weight: 600;
                        color: #475569;
                        transition: all 0.2s;
                    }
                    .toolbar-btn:hover { background: #f1f5f9; color: #0f172a; }

                    #viewport {
                        transform-origin: top center;
                        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        width: 100%;
                        min-height: 100vh;
                    }

                    #root { display: flex; flex-direction: column; padding: 2rem; }
                </style>
            </head>
            <body>
                <div id="toolbar">
                    <button class="toolbar-btn" onclick="setZoom(currentZoom - 0.1)" title="Zoom Out">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                    <button class="toolbar-btn" style="font-size:0.8rem; width: 44px;" onclick="setZoom(1)" title="Reset Zoom" id="zoomLevel">100%</button>
                    <button class="toolbar-btn" onclick="setZoom(currentZoom + 0.1)" title="Zoom In">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                </div>

                <div id="viewport">
                    <div id="root"></div>
                </div>

                <script>
                    let currentZoom = 1;
                    function setZoom(level) {
                        currentZoom = Math.max(0.5, Math.min(3, level));
                        document.getElementById('viewport').style.transform = \`scale(\${currentZoom})\`;
                        
                        // Adjust width to prevent scrollbar issues when zooming out
                        if(currentZoom < 1) {
                            document.getElementById('viewport').style.width = \`\${(1 / currentZoom) * 100}%\`;
                        } else {
                            document.getElementById('viewport').style.width = '100%';
                        }

                        document.getElementById('zoomLevel').innerText = Math.round(currentZoom * 100) + '%';
                    }
                <\/script>

                <script type="text/babel" data-type="module">
                    const { useState, useEffect, useContext, useReducer, useCallback, useMemo, useRef, useImperativeHandle, useLayoutEffect, useDebugValue } = React;
                    
                    ${code}

                    ${rootComp ? `
                    setTimeout(() => {
                        const rootElement = document.getElementById('root');
                        if (rootElement && !rootElement.innerHTML) {
                            const root = ReactDOM.createRoot(rootElement);
                            root.render(React.createElement(${rootComp}));
                        }
                    }, 50);
                    ` : ''}
                <\/script>
            </body>
            </html>
        `;
        previewWindow.document.open();
        previewWindow.document.write(source);
        previewWindow.document.close();
    }
}

// Utility: Escape HTML to prevent XSS in rendering lists
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Run
init();
