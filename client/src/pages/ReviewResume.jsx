import { FileText, Sparkles, MessageSquare, Send, ArrowLeft, Clock, ChevronRight, Loader2 } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/react';
import toast from 'react-hot-toast';
import Markdown from 'react-markdown';

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const ReviewResume = () => {

    // --- State ---
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState('');
    const [activeResumeId, setActiveResumeId] = useState(null);
    const [ingestionStatus, setIngestionStatus] = useState(null);

    // Saved resumes list
    const [resumes, setResumes] = useState([]);
    const [resumesLoading, setResumesLoading] = useState(false);

    // Chat state
    const [showChat, setShowChat] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [chatHistoryLoading, setChatHistoryLoading] = useState(false);

    const chatEndRef = useRef(null);
    const { getToken } = useAuth();

    // --- Load saved resumes on mount ---
    useEffect(() => {
        loadResumes();
    }, []);

    // --- Auto-scroll chat ---
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const getAuthHeaders = async () => {
        const token = await getToken();
        return { Authorization: `Bearer ${token}` };
    };

    // --- API Functions ---

    const loadResumes = async () => {
        try {
            setResumesLoading(true);
            const headers = await getAuthHeaders();
            const { data } = await axios.get('/api/resumes', { headers });
            if (data.success) {
                setResumes(data.resumes);
            }
        } catch (error) {
            console.error('Failed to load resumes:', error);
        } finally {
            setResumesLoading(false);
        }
    };

    const loadResume = async (resumeId) => {
        try {
            setLoading(true);
            const headers = await getAuthHeaders();
            const { data } = await axios.get(`/api/resumes/${resumeId}`, { headers });

            if (data.success) {
                const resume = data.resume;
                setActiveResumeId(resume.id);
                setIngestionStatus(resume.ingestion_status);

                // Convert stored review JSON to Markdown for display
                if (resume.review_content) {
                    const review = typeof resume.review_content === 'string'
                        ? JSON.parse(resume.review_content)
                        : resume.review_content;
                    setContent(reviewToMarkdown(review));
                }
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load resume');
        } finally {
            setLoading(false);
        }
    };

    const loadChatHistory = async (resumeId) => {
        try {
            setChatHistoryLoading(true);
            const headers = await getAuthHeaders();
            const { data } = await axios.get(`/api/resumes/${resumeId}/chat`, { headers });
            if (data.success) {
                setChatMessages(data.messages);
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        } finally {
            setChatHistoryLoading(false);
        }
    };

    const sendChatMessage = async () => {
        if (!chatInput.trim() || chatLoading || !activeResumeId) return;

        const userMessage = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', content: userMessage, id: Date.now() }]);
        setChatLoading(true);

        try {
            const headers = await getAuthHeaders();
            const { data } = await axios.post(
                `/api/resumes/${activeResumeId}/chat`,
                { message: userMessage },
                { headers }
            );

            if (data.success) {
                setChatMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.message.content,
                    id: Date.now() + 1,
                }]);
            } else {
                toast.error(data.message);
                // Remove the optimistic user message on failure
                setChatMessages(prev => prev.slice(0, -1));
                setChatInput(userMessage);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Chat failed');
            setChatMessages(prev => prev.slice(0, -1));
            setChatInput(userMessage);
        } finally {
            setChatLoading(false);
        }
    };

    // --- Upload Handler (enhanced) ---
    const onSubmitHandler = async (e) => {
        e.preventDefault();

        if (!file) {
            toast.error("Please upload a resume first");
            return;
        }

        try {
            setLoading(true);
            setContent('');
            setActiveResumeId(null);
            setShowChat(false);
            setChatMessages([]);

            const formData = new FormData();
            formData.append('resume', file);

            const token = await getToken();

            const { data } = await axios.post('/api/ai/resume-review',
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            if (data.success) {
                setContent(data.content);
                if (data.resume_id) {
                    setActiveResumeId(data.resume_id);
                    setIngestionStatus(data.ingestion_status);
                }
                toast.success('Resume reviewed successfully!');
                // Refresh the resume list
                loadResumes();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error("🚨 [FRONTEND] API Error:", error);
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Select a saved resume ---
    const selectResume = async (resumeId) => {
        setShowChat(false);
        setChatMessages([]);
        await loadResume(resumeId);
    };

    // --- Open chat for active resume ---
    const openChat = async () => {
        if (!activeResumeId) return;
        if (ingestionStatus !== 'completed') {
            toast.error('Resume is still processing. Chat will be available once processing completes.');
            return;
        }
        setShowChat(true);
        await loadChatHistory(activeResumeId);
    };

    // --- Back to review from chat ---
    const backToReview = () => {
        setShowChat(false);
    };

    // --- Helper: convert review JSON to Markdown ---
    const reviewToMarkdown = (review) => {
        let md = `**Overall Impression:**\n${review.overallImpression}\n\n`;
        md += `**Strengths:**\n`;
        review.strengths?.forEach(s => { md += `* ${s}\n`; });
        md += '\n**Weaknesses:**\n';
        review.weaknesses?.forEach(w => { md += `* ${w}\n`; });
        md += '\n**Specific Suggestions:**\n';
        review.suggestions?.forEach(sg => { md += `* ${sg}\n`; });
        return md;
    };

    // --- Format date ---
    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    // --- Render ---
    return (
        <div className='h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700'>

            {/* Left Column: Upload + Saved Resumes */}
            <div className='w-full max-w-lg space-y-4'>
                {/* Upload Form */}
                <form onSubmit={onSubmitHandler} className='p-6 bg-white rounded-lg border border-gray-200'>
                    <div className='flex items-center gap-3'>
                        <Sparkles className='w-6 text-[#00B47D]' />
                        <h1 className='text-xl font-semibold'>Resume Review</h1>
                    </div>

                    <p className='mt-6 text-sm font-medium'>Upload Resume</p>
                    <input
                        onChange={(e) => setFile(e.target.files[0])}
                        type="file"
                        accept='.pdf'
                        className='w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300 text-gray-600 cursor-pointer'
                    />
                    <p className='text-xs text-gray-500 font-light mt-1'>Supports PDF format (max 5MB)</p>

                    <button type="submit" disabled={loading} className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#00B47D] to-[#008E9B] text-white px-4 py-3 mt-8 text-sm font-medium rounded-lg cursor-pointer hover:opacity-90 transition disabled:opacity-75 disabled:cursor-not-allowed'>
                        {loading ? (
                            <span className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></span>
                        ) : (
                            <FileText className='w-5 h-5' />
                        )}
                        Review Resume
                    </button>
                </form>

                {/* Saved Resumes List */}
                <div className='p-6 bg-white rounded-lg border border-gray-200'>
                    <div className='flex items-center gap-3 pb-3 border-b border-gray-100'>
                        <Clock className='w-5 text-[#00B47D]' />
                        <h2 className='text-lg font-semibold'>Saved Resumes</h2>
                    </div>

                    {resumesLoading ? (
                        <div className='py-8 flex justify-center'>
                            <Loader2 className='w-6 h-6 text-gray-400 animate-spin' />
                        </div>
                    ) : resumes.length === 0 ? (
                        <p className='text-sm text-gray-400 py-6 text-center'>No resumes saved yet. Upload one above!</p>
                    ) : (
                        <div className='mt-3 space-y-2 max-h-64 overflow-y-auto'>
                            {resumes.map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => selectResume(r.id)}
                                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                        activeResumeId === r.id
                                            ? 'border-[#00B47D] bg-[#00B47D]/5'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className='flex-1 min-w-0'>
                                        <p className='text-sm font-medium truncate'>{r.filename}</p>
                                        <div className='flex items-center gap-2 mt-1'>
                                            <span className='text-xs text-gray-400'>{formatDate(r.created_at)}</span>
                                            {r.ingestion_status === 'completed' && (
                                                <span className='text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded'>Ready</span>
                                            )}
                                            {r.ingestion_status === 'processing' && (
                                                <span className='text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded'>Processing</span>
                                            )}
                                            {r.ingestion_status === 'failed' && (
                                                <span className='text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded'>Failed</span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className='w-4 h-4 text-gray-400 flex-shrink-0' />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Review / Chat */}
            <div className='flex-1 min-w-[300px] flex flex-col bg-white rounded-lg border border-gray-200 min-h-96 max-h-[600px]'>

                {!showChat ? (
                    /* --- Review View --- */
                    <>
                        <div className='flex items-center justify-between p-6 pb-4 border-b border-gray-100'>
                            <div className='flex items-center gap-3'>
                                <FileText className='w-6 text-[#00B47D]' />
                                <h1 className='text-xl font-semibold'>Analysis Results</h1>
                            </div>
                            {activeResumeId && ingestionStatus === 'completed' && (
                                <button
                                    onClick={openChat}
                                    className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#3C81F6] to-[#9234EA] rounded-lg hover:opacity-90 transition cursor-pointer'
                                >
                                    <MessageSquare className='w-4 h-4' />
                                    Chat
                                </button>
                            )}
                        </div>

                        {!content ? (
                            <div className='flex-1 flex justify-center items-center p-6'>
                                <div className='text-sm flex flex-col items-center gap-5 text-gray-400'>
                                    <FileText className='w-16 h-16 opacity-50' />
                                    <p className='text-sm max-w-xs text-center leading-relaxed'>Upload your resume and click "Review Resume" to get started</p>
                                </div>
                            </div>
                        ) : (
                            <div className='flex-1 overflow-y-auto p-6 text-sm text-slate-600'>
                                <div className='reset-tw'>
                                    <Markdown>{content}</Markdown>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    /* --- Chat View --- */
                    <>
                        <div className='flex items-center gap-3 p-6 pb-4 border-b border-gray-100'>
                            <button
                                onClick={backToReview}
                                className='p-1.5 hover:bg-gray-100 rounded-lg transition cursor-pointer'
                            >
                                <ArrowLeft className='w-5 h-5 text-gray-500' />
                            </button>
                            <MessageSquare className='w-5 text-[#3C81F6]' />
                            <h1 className='text-lg font-semibold'>Resume Chat</h1>
                        </div>

                        {/* Chat Messages */}
                        <div className='flex-1 overflow-y-auto p-4 space-y-4'>
                            {chatHistoryLoading ? (
                                <div className='flex justify-center py-8'>
                                    <Loader2 className='w-6 h-6 text-gray-400 animate-spin' />
                                </div>
                            ) : chatMessages.length === 0 ? (
                                <div className='text-center py-8'>
                                    <MessageSquare className='w-12 h-12 text-gray-300 mx-auto mb-3' />
                                    <p className='text-sm text-gray-400'>Ask questions about your resume, skills, or improvements</p>
                                    <p className='text-xs text-gray-300 mt-1'>e.g., "How can I improve my bullet points?" or "What are my strengths?"</p>
                                </div>
                            ) : (
                                chatMessages.map((msg, idx) => (
                                    <div
                                        key={msg.id || idx}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                                            msg.role === 'user'
                                                ? 'bg-gradient-to-r from-[#3C81F6] to-[#9234EA] text-white rounded-br-md'
                                                : 'bg-gray-100 text-slate-700 rounded-bl-md'
                                        }`}>
                                            {msg.role === 'assistant' ? (
                                                <div className='reset-tw'>
                                                    <Markdown>{msg.content}</Markdown>
                                                </div>
                                            ) : (
                                                msg.content
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}

                            {chatLoading && (
                                <div className='flex justify-start'>
                                    <div className='bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md'>
                                        <div className='flex items-center gap-1.5'>
                                            <span className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '0ms' }}></span>
                                            <span className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '150ms' }}></span>
                                            <span className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={chatEndRef} />
                        </div>

                        {/* Chat Input */}
                        <div className='p-4 border-t border-gray-100'>
                            <div className='flex items-center gap-2'>
                                <input
                                    type='text'
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                                    placeholder='Ask about your resume, experience, or ways to improve...'
                                    maxLength={2000}
                                    disabled={chatLoading}
                                    className='flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-[#3C81F6] transition disabled:opacity-60'
                                />
                                <button
                                    onClick={sendChatMessage}
                                    disabled={chatLoading || !chatInput.trim()}
                                    className='p-2.5 bg-gradient-to-r from-[#3C81F6] to-[#9234EA] text-white rounded-lg hover:opacity-90 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                                >
                                    <Send className='w-4 h-4' />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ReviewResume;