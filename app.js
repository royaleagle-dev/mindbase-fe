const { useState, useEffect, useCallback, useRef, useMemo } = React;

const RF = window.ReactFlow;
const ReactFlow = RF.ReactFlow || RF.default || RF;
const Background = RF.Background;
const Controls = RF.Controls;
const Handle = RF.Handle;
const Position = RF.Position;
const useNodesState = RF.useNodesState;
const useEdgesState = RF.useEdgesState;
const addEdge = RF.addEdge;

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001/api' 
    : 'https://mindbase-be-production.up.railway.app/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('mindbase_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

const checkAuth = () => {
    const token = localStorage.getItem('mindbase_token');
    if (!token) {
        window.location.href = 'login.html';
        return null;
    }
    return token;
};

const handleLogout = () => {
    localStorage.removeItem('mindbase_token');
    localStorage.removeItem('mindbase_user');
    localStorage.removeItem('mindbase_current_map');
    window.location.href = 'login.html';
};

// ─── Custom Node Component ──────────────────────────
function CustomNode({ id, data, selected }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(data.title || '');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleTitleClick = useCallback((e) => {
        e.stopPropagation();
        setIsEditing(true);
        setEditValue(data.title || '');
    }, [data.title]);

    const handleBlur = useCallback(() => {
        setIsEditing(false);
        const trimmed = editValue.trim();
        const newTitle = trimmed || (data.title || '');
        if (newTitle !== data.title) {
            data.title = newTitle;
            const mapId = localStorage.getItem('mindbase_current_map');
            fetch(`${API_URL}/nodes/${id}/title`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ title: newTitle, mapId })
            }).catch(err => console.error('Failed to update title:', err));
        }
    }, [editValue, data, id]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            handleBlur();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setEditValue(data.title || '');
        }
    }, [handleBlur, data.title]);

    return (
        <>
            <Handle type="target" position={Position.Top} />
            <div className="custom-node-wrapper">
                {isEditing ? (
                    <input
                        ref={inputRef}
                        className="node-title-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        maxLength={40}
                    />
                ) : (
                    <div className="node-title" onClick={handleTitleClick} title="Click to edit title">
                        {data.title || 'Untitled'}
                    </div>
                )}
                <div className="node-label">{data.label}</div>
            </div>
            <Handle type="source" position={Position.Bottom} />
        </>
    );
}

const nodeTypes = { default: CustomNode };

// ─── New Map Modal ────────────────────────────────
function NewMapModal({ onClose, onCreate }) {
    const [name, setName] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (trimmed) {
            onCreate(trimmed);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>Create New Map</h2>
                <p>Give your knowledge graph a name</p>
                <form onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Product Strategy"
                        maxLength={50}
                    />
                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn">
                            Create Map
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Map Selector Component ───────────────────────
function MapSelector({ maps, currentMapId, onSelect, onCreate, onDelete }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentMap = maps.find(m => m.id === currentMapId);

    return (
        <div className="map-selector" ref={dropdownRef}>
            <button 
                className={`map-dropdown-btn ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{currentMap?.name || 'Select Map'}</span>
                <span className="chevron">▼</span>
            </button>
            
            {isOpen && (
                <div className="map-dropdown-menu">
                    <div className="map-dropdown-header">Your Maps</div>
                    {maps.map(map => (
                        <div 
                            key={map.id} 
                            className={`map-dropdown-item ${map.id === currentMapId ? 'active' : ''}`}
                            onClick={() => {
                                onSelect(map.id);
                                setIsOpen(false);
                            }}
                        >
                            <span className="map-name">
                                {map.id === currentMapId && <span className="check">✓</span>}
                                {map.name}
                            </span>
                            {maps.length > 1 && (
                                <button 
                                    className="delete-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`Delete "${map.name}"? All nodes and edges will be lost.`)) {
                                            onDelete(map.id);
                                        }
                                    }}
                                    title="Delete map"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                    <div className="map-new-btn" onClick={() => {
                        setIsOpen(false);
                        onCreate();
                    }}>
                        <span>+</span> New Map
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main App ─────────────────────────────────────
function App() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [inputValue, setInputValue] = useState('');
    const [selectedNode, setSelectedNode] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [maps, setMaps] = useState([]);
    const [currentMapId, setCurrentMapId] = useState(null);
    const [showNewMapModal, setShowNewMapModal] = useState(false);
    const reactFlowWrapper = useRef(null);

    // ─── Auth Check ─────────────────────────────────
    useEffect(() => {
        const token = checkAuth();
        if (!token) return;

        fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(r => {
            if (r.status === 401 || r.status === 403) {
                handleLogout();
                return null;
            }
            return r.json();
        })
        .then(data => {
            if (data?.user) setUser(data.user);
        })
        .catch(() => handleLogout());
    }, []);

    // ─── Load Maps ──────────────────────────────────
    const loadMaps = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/maps`, {
                headers: getAuthHeaders()
            });
            if (res.status === 401 || res.status === 403) {
                handleLogout();
                return;
            }
            const data = await res.json();
            setMaps(data.maps || []);
            
            // Restore or select first map
            const savedMapId = localStorage.getItem('mindbase_current_map');
            const validMap = data.maps?.find(m => m.id === parseInt(savedMapId));
            if (validMap) {
                setCurrentMapId(validMap.id);
            } else if (data.maps?.length > 0) {
                setCurrentMapId(data.maps[0].id);
                localStorage.setItem('mindbase_current_map', data.maps[0].id);
            }
        } catch (err) {
            console.error('Failed to load maps:', err);
        }
    }, []);

    useEffect(() => {
        loadMaps();
    }, [loadMaps]);

    // ─── Load Nodes & Edges when map changes ────────
    useEffect(() => {
        if (!currentMapId) return;
        
        setIsLoading(true);
        localStorage.setItem('mindbase_current_map', currentMapId);
        
        const token = localStorage.getItem('mindbase_token');
        fetch(`${API_URL}/data?mapId=${currentMapId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(r => {
            if (r.status === 401 || r.status === 403) {
                handleLogout();
                return null;
            }
            return r.json();
        })
        .then(data => {
            if (!data) return;
            setNodes(data.nodes);
            setEdges(data.edges);
            setIsLoading(false);
        })
        .catch(err => {
            console.error('Failed to load:', err);
            setIsLoading(false);
        });
    }, [currentMapId, setNodes, setEdges]);

    // ─── Create New Map ─────────────────────────────
    const handleCreateMap = useCallback(async (name) => {
        try {
            const res = await fetch(`${API_URL}/maps`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name })
            });
            if (res.status === 401 || res.status === 403) {
                handleLogout();
                return;
            }
            const newMap = await res.json();
            setMaps(prev => [newMap, ...prev]);
            setCurrentMapId(newMap.id);
            setShowNewMapModal(false);
        } catch (err) {
            console.error('Failed to create map:', err);
        }
    }, []);

    // ─── Delete Map ─────────────────────────────────
    const handleDeleteMap = useCallback(async (mapId) => {
        try {
            const res = await fetch(`${API_URL}/maps/${mapId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.status === 401 || res.status === 403) {
                handleLogout();
                return;
            }
            setMaps(prev => {
                const filtered = prev.filter(m => m.id !== mapId);
                if (currentMapId === mapId && filtered.length > 0) {
                    setCurrentMapId(filtered[0].id);
                }
                return filtered;
            });
        } catch (err) {
            console.error('Failed to delete map:', err);
        }
    }, [currentMapId]);

    // ─── Glowing effects ────────────────────────────
    const glowingEdges = useMemo(() => {
        if (!selectedNode) return edges;
        return edges.map(edge => ({
            ...edge,
            className: edge.target === selectedNode ? 'glowing' : '',
        }));
    }, [edges, selectedNode]);

    const glowingNodes = useMemo(() => {
        if (!selectedNode) return nodes;
        const incomingSources = new Set(
            edges.filter(e => e.target === selectedNode).map(e => e.source)
        );
        return nodes.map(node => ({
            ...node,
            className: incomingSources.has(node.id) ? 'glowing' : '',
        }));
    }, [nodes, edges, selectedNode]);

    // ─── Add Node ───────────────────────────────────
    const addNode = useCallback(async (e) => {
        e.preventDefault();
        if (!inputValue.trim() || !currentMapId) return;

        const x = Math.random() * 400 + 50;
        const y = Math.random() * 300 + 50;
        const trimmedLabel = inputValue.trim();
        const title = trimmedLabel.length > 20 ? trimmedLabel.slice(0, 20) + '...' : trimmedLabel;

        try {
            const res = await fetch(`${API_URL}/nodes`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ label: trimmedLabel, title, x, y, mapId: currentMapId })
            });
            
            if (res.status === 401 || res.status === 403) {
                handleLogout();
                return;
            }
            
            const newNode = await res.json();
            setNodes(prev => [...prev, newNode]);

            if (selectedNode) {
                const edgeRes = await fetch(`${API_URL}/edges`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ source: selectedNode, target: newNode.id, mapId: currentMapId })
                });
                
                if (edgeRes.status === 401 || edgeRes.status === 403) {
                    handleLogout();
                    return;
                }
                
                const newEdge = await edgeRes.json();
                setEdges(prev => [...prev, newEdge]);
            }

            setInputValue('');
        } catch (err) {
            console.error('Failed to add node:', err);
        }
    }, [inputValue, selectedNode, currentMapId, setNodes, setEdges]);

    // ─── Connect Nodes ──────────────────────────────
    const onConnect = useCallback(async (params) => {
        if (!currentMapId) return;
        try {
            const res = await fetch(`${API_URL}/edges`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ source: params.source, target: params.target, mapId: currentMapId })
            });
            
            if (res.status === 401 || res.status === 403) {
                handleLogout();
                return;
            }
            
            const newEdge = await res.json();
            setEdges(prev => addEdge(newEdge, prev));
        } catch (err) {
            console.error('Failed to connect:', err);
        }
    }, [currentMapId, setEdges]);

    // ─── Node Selection ─────────────────────────────
    const onNodeClick = useCallback((_, node) => {
        setSelectedNode(prev => prev === node.id ? null : node.id);
    }, []);

    // ─── Node Drag Stop ─────────────────────────────
    const onNodeDragStop = useCallback(async (_, node) => {
        if (!currentMapId) return;
        try {
            const res = await fetch(`${API_URL}/nodes/${node.id}/position`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ x: node.position.x, y: node.position.y, mapId: currentMapId })
            });
            
            if (res.status === 401 || res.status === 403) {
                handleLogout();
            }
        } catch (err) {
            console.error('Failed to update position:', err);
        }
    }, [currentMapId]);

    // ─── Delete Node ──────────────────────────────
    useEffect(() => {
        const handleKeyDown = async (e) => {
            if (e.key === 'Delete' && selectedNode && currentMapId) {
                try {
                    const res = await fetch(`${API_URL}/nodes/${selectedNode}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ mapId: currentMapId })
                    });
                    
                    if (res.status === 401 || res.status === 403) {
                        handleLogout();
                        return;
                    }
                    
                    setNodes(prev => prev.filter(n => n.id !== selectedNode));
                    setEdges(prev => prev.filter(e => e.source !== selectedNode && e.target !== selectedNode));
                    setSelectedNode(null);
                } catch (err) {
                    console.error('Failed to delete:', err);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNode, currentMapId, setNodes, setEdges]);

    return (
        <div ref={reactFlowWrapper} style={{ width: '100vw', height: '100vh' }}>
            <div className="topbar">
                <div className="logo">MindBase</div>
                
                <MapSelector
                    maps={maps}
                    currentMapId={currentMapId}
                    onSelect={setCurrentMapId}
                    onCreate={() => setShowNewMapModal(true)}
                    onDelete={handleDeleteMap}
                />
                
                <form onSubmit={addNode}>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={selectedNode ? "Link new thought to selected..." : "Add a thought..."}
                    />
                    <button type="submit" className={selectedNode ? 'btn btn-secondary' : 'btn'}>
                        {selectedNode ? '🔗 Link' : '➕ Add'}
                    </button>
                </form>
                
                <div className="stats">
                    <span className="stat-item">
                        <span className="stat-dot"></span>
                        {nodes.length} nodes
                    </span>
                    <span className="stat-item">
                        <span className="stat-dot edge"></span>
                        {edges.length} edges
                    </span>
                </div>
                
                {user && (
                    <div className="user-badge">
                        <span className="user-name">
                            {user.displayName || user.username}
                        </span>
                        <button className="btn-logout" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                )}
            </div>

            {isLoading && (
                <div className="loading">
                    Loading your mind...
                </div>
            )}

            <ReactFlow
                nodes={glowingNodes}
                edges={glowingEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onNodeDragStop={onNodeDragStop}
                nodeTypes={nodeTypes}
                fitView
                style={{ background: '#faf8f5' }}
            >
                <Background color="#e7e5e0" gap={24} size={1} />
                <Controls />
            </ReactFlow>

            <div className="hint">
                <kbd>Click</kbd> to select · <kbd>Delete</kbd> to remove · Drag between nodes to connect · <kbd>Click title</kbd> to edit
            </div>

            {showNewMapModal && (
                <NewMapModal 
                    onClose={() => setShowNewMapModal(false)} 
                    onCreate={handleCreateMap} 
                />
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);