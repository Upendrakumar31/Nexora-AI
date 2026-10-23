import React, { useState } from 'react';
import { Sparkles, Image as ImageIcon } from 'lucide-react'; 
import axios from 'axios';
import { useAuth } from '@clerk/react';
import toast from 'react-hot-toast';

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const GenerateImages = () => {

    const styles = [
        'Realistic', 
        'Ghibli Style', 
        'Anime Style',
        'Cartoon style',
        'Fantasy style',
        'Realistic style',
        '3D style',
        'Portrait style' // Fixed typo from 'Potrait'
    ];

    const [input, setInput] = useState('');
    const [selectedStyle, setSelectedStyle] = useState('Realistic');
    const [publish, setPublish] = useState(false);
    
    // Added state for loading and storing the returned image URL
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState('');

    const { getToken } = useAuth();

    const onSubmitHandler = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            // Combine user input with the selected style for a better prompt
            const prompt = `${input}, generated in a detailed ${selectedStyle}`;
            
            const token = await getToken();
            
            // Call your backend generateImage controller
            const { data } = await axios.post('/api/ai/generate-image', 
                { prompt, publish },
                { headers: { Authorization: `Bearer ${token}` }} 
            );
        
            if (data.success) {
                // The backend returns the secure_url from Cloudinary
                setContent(data.content);
                toast.success('Image generated successfully!');
            } else {
                toast.error(data.message); 
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false); 
        }
    }

    return (
        <div className='h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700'>
            
            <form onSubmit={onSubmitHandler} className='w-full max-w-lg p-6 bg-white rounded-lg border border-gray-200'>
                
                <div className='flex items-center gap-3'>
                    <Sparkles className='w-6 text-[#00AD25]' />
                    <h1 className='text-xl font-semibold'>AI Image Generator</h1>
                </div>

                <p className='mt-6 text-sm font-medium'>Describe your Image</p>
                <textarea 
                    onChange={(e) => setInput(e.target.value)} 
                    value={input}
                    rows={4} 
                    className='w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300 focus:border-[#0BB0D7] transition' 
                    placeholder='Describe what you want to see in the image' 
                    required 
                />

                <p className='mt-6 text-sm font-medium'>Style</p>
                <div className='mt-3 flex gap-3 flex-wrap'>
                    {styles.map((style) => (
                        <span 
                            key={style}
                            onClick={() => setSelectedStyle(style)}
                            className={`text-xs px-4 py-1 border rounded-full cursor-pointer transition ${selectedStyle === style ? 'bg-green-50 text-green-700 border-green-200 font-medium' : 'text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                        >
                            {style}
                        </span>
                    ))}
                </div>

                <div className='my-6 flex items-center gap-2'>
                  <label className='relative flex items-center cursor-pointer'>
                    <input type="checkbox" onChange={(e)=>setPublish(e.target.checked)}
                    checked={publish} className='sr-only peer' />
                    
                    <div className='w-9 h-5 bg-slate-300 rounded-full peer-checked:bg-green-500 transition'></div>
                    
                    <span className='absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition peer-checked:translate-x-4'></span>
                  </label>

                  <p className='text-sm'>Make this image public</p>
                </div>

                <button disabled={loading} className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#00AD25] to-[#04FF50] text-white px-4 py-3 mt-8 text-sm font-medium rounded-lg cursor-pointer hover:bg-[#0999bc] transition disabled:opacity-75 disabled:cursor-not-allowed'>
                    {loading ? (
                        <span className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></span>
                    ) : (
                        <ImageIcon className='w-5 h-5' />
                    )}
                    Generate image
                </button>
            </form>

            <div className='flex-1 min-w-[300px] p-6 bg-white rounded-lg flex flex-col border border-gray-200 min-h-96 max-h-[600px]'>
                <div className='flex items-center gap-3 pb-4 border-b border-gray-100'>
                    <ImageIcon className='w-6 text-[#00AD25]' />
                    <h1 className='text-xl font-semibold'>Generated image</h1>
                </div>

                {!content ? (
                    <div className='flex-1 flex justify-center items-center'>
                        <div className='text-sm flex flex-col items-center gap-5 text-gray-400'>
                            <ImageIcon className='w-16 h-16 opacity-50' />
                            <p className='text-sm max-w-xs text-center leading-relaxed'>Describe an image and click "Generate image" to get started</p>
                        </div>
                    </div>
                ) : (
                    <div className='mt-4 flex-1 flex justify-center items-center h-full overflow-hidden'>
                        <img 
                            src={content} 
                            alt="AI Generated" 
                            className='w-full h-auto max-h-full object-contain rounded-md shadow-sm border border-gray-200' 
                        />
                    </div>
                )}
            </div>

        </div>
    );
}

export default GenerateImages;