import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import './App.css';

function App() {
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentView, setCurrentView] = useState('blocks');
    const [responseData, setResponseData] = useState(null);
    const [isOnline, setIsOnline] = useState(false);
    const [status, setStatus] = useState('Agents ready');
    const [expandedReasoning, setExpandedReasoning] = useState(new Set());
    const messagesEndRef = useRef(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const intervalId = setInterval(() => {
            checkHealth();
            fetchLatestAnswer();
            fetchScreenshot();
        }, 3000);
        return () => clearInterval(intervalId);
    }, [messages]);

    const checkHealth = async () => {
        try {
            await axios.get('http://127.0.0.1:8000/health');
            setIsOnline(true);
            console.log('System is online');
        } catch {
            setIsOnline(false);
            console.log('System is offline');
        }
    };

    const fetchScreenshot = async () => {
        try {
            const timestamp = new Date().getTime();
            const response = await axios.get(`http://127.0.0.1:8000/screenshots/updated_screen.png?timestamp=${timestamp}`, {
                responseType: 'blob'
            });
            console.log('Screenshot fetched successfully');
            const imageUrl = URL.createObjectURL(response.data);
            setResponseData((prev) => {
                if (prev?.screenshot && prev.screenshot !== 'placeholder.png') {
                    URL.revokeObjectURL(prev.screenshot);
                }
                return {
                    ...prev,
                    screenshot: imageUrl,
                    screenshotTimestamp: new Date().getTime()
                };
            });
        } catch (err) {
            console.error('Error fetching screenshot:', err);
            setResponseData((prev) => ({
                ...prev,
                screenshot: 'placeholder.png',
                screenshotTimestamp: new Date().getTime()
            }));
        }
    };

    const normalizeAnswer = (answer) => {
        return answer
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[.,!?]/g, '');
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const toggleReasoning = (messageIndex) => {
        setExpandedReasoning(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageIndex)) {
                newSet.delete(messageIndex);
            } else {
                newSet.add(messageIndex);
            }
            return newSet;
        });
    };

    const fetchLatestAnswer = async () => {
        try {
            const response = await axios.get('http://127.0.0.1:8000/latest_answer');
            const data = response.data;
            updateData(data);

            if (!data.answer || data.answer.trim() === '') return;

            const normalizedNewAnswer = normalizeAnswer(data.answer);
            const answerExists = messages.some(
                (msg) => normalizeAnswer(msg.content) === normalizedNewAnswer
            );

            if (!answerExists) {
                setMessages((prev) => [
                    ...prev,
                    {
                        type: 'agent',
                        content: data.answer,
                        reasoning: data.reasoning,
                        agentName: data.agent_name,
                        status: data.status,
                        uid: data.uid,
                    },
                ]);
                setStatus(data.status);
                scrollToBottom();
            } else {
                console.log('Duplicate answer detected, skipping:', data.answer);
            }
        } catch (error) {
            console.error('Error fetching latest answer:', error);
        }
    };

    const updateData = (data) => {
        setResponseData((prev) => ({
            ...prev,
            blocks: data.blocks || prev?.blocks || null,
            done: data.done,
            answer: data.answer,
            agent_name: data.agent_name,
            status: data.status,
            uid: data.uid,
        }));
    };

    const handleStop = async (e) => {
        e.preventDefault();
        checkHealth();
        setIsLoading(false);
        setError(null);
        try {
            await axios.get('http://127.0.0.1:8000/stop');
            setStatus("Requesting stop...");
        } catch (err) {
            console.error('Error stopping the agent:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        checkHealth();
        if (!query.trim()) return;

        setMessages((prev) => [...prev, { type: 'user', content: query }]);
        setIsLoading(true);
        setError(null);

        try {
            console.log('Sending query:', query);
            setQuery('waiting for response...');
            const response = await axios.post('http://127.0.0.1:8000/query', {
                query,
                tts_enabled: false
            });
            setQuery('Enter your query...');
            updateData(response.data);
        } catch (err) {
            console.error('Error:', err);
            setError('Failed to process query.');
            setMessages((prev) => [
                ...prev,
                { type: 'error', content: 'Error: Unable to get a response.' },
            ]);
        } finally {
            setIsLoading(false);
            setQuery('');
        }
    };

    const handleGetScreenshot = async () => {
        try {
            setCurrentView('screenshot');
        } catch {
            setError('Browser not in use');
        }
    };

    return (
        <div className="app">
            <header className="header"><h1>AgenticSeek</h1></header>
            <main className="main">
                <div className="app-sections">
                    {/* Chat Section */}
                    <div className="chat-section">
                        <h2>Chat Interface</h2>
                        <div className="messages">
                            {messages.length === 0 ? (
                                <p className="placeholder">No messages yet. Type below to start!</p>
                            ) : (
                                messages.map((msg, index) => (
                                    <div key={index} className={`message ${msg.type}-message`}>
                                        <div className="message-header">
                                            {msg.type === 'agent' && (
                                                <>
                                                    <span className="agent-name">{msg.agentName}</span>
                                                    {msg.reasoning && expandedReasoning.has(index) && (
                                                        <div className="reasoning-content">
                                                            <ReactMarkdown>{msg.reasoning}</ReactMarkdown>
                                                        </div>
                                                    )}
                                                    <button
                                                        className="reasoning-toggle"
                                                        onClick={() => toggleReasoning(index)}
                                                        title={expandedReasoning.has(index) ? "Hide reasoning" : "Show reasoning"}
                                                    >
                                                        {expandedReasoning.has(index) ? '▼' : '▶'} Reasoning
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        <div className="message-content">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        {isOnline && <div className="loading-animation">{status}</div>}
                        {!isLoading && !isOnline && <p className="loading-animation">System offline. Deploy backend first.</p>}
                        <form onSubmit={handleSubmit} className="input-form">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Type your query..."
                                disabled={isLoading}
                            />
                            <button type="submit" disabled={isLoading}>Send</button>
                            <button onClick={handleStop}>Stop</button>
                        </form>
                    </div>

                    {/* Computer Section */}
                    <div className="computer-section">
                        <h2>Computer View</h2>
                        <div className="view-selector">
                            <button
                                className={currentView === 'blocks' ? 'active' : ''}
                                onClick={() => setCurrentView('blocks')}
                            >
                                Editor View
                            </button>
                            <button
                                className={currentView === 'screenshot' ? 'active' : ''}
                                onClick={responseData?.screenshot ? () => setCurrentView('screenshot') : handleGetScreenshot}
                            >
                                Browser View
                            </button>
                        </div>
                        <div className="content">
                            {error && <p className="error">{error}</p>}
                            {currentView === 'blocks' ? (
                                <div className="blocks">
                                    {responseData?.blocks && Object.values(responseData.blocks).length > 0 ? (
                                        Object.values(responseData.blocks).map((block, index) => (
                                            <div key={index} className="block">
                                                <p className="block-tool">Tool: {block.tool_type}</p>
                                                <pre>{block.block}</pre>
                                                <p className="block-feedback">Feedback: {block.feedback}</p>
                                                <p className={block.success ? 'block-success' : 'block-failure'}>
                                                    {block.success ? 'Success' : 'Failure'}
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="block">
                                            <p className="block-tool">Tool: No tool in use</p>
                                            <pre>No file opened</pre>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="screenshot">
                                    <img
                                        src={responseData?.screenshot || 'placeholder.png'}
                                        alt="Screenshot"
                                        onError={(e) => {
                                            e.target.src = 'placeholder.png';
                                            console.error('Failed to load screenshot');
                                        }}
                                        key={responseData?.screenshotTimestamp || 'default'}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;
