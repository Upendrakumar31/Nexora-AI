import { Eraser, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/react';
import toast from 'react-hot-toast';

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const RemoveBackground = () => {

    const [input, setInput] = useState(null);
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState('');

    const { getToken } = useAuth();

    const onSubmitHandler = async (e) => {
        e.preventDefault();
        console.log("🚨 [FRONTEND] Form submitted. File selected:", input);
        
        // Manual check replaces the HTML5 'required' attribute
        if (!input) {
            toast.error("Please select an image first");
            return;
        }

        try {
            setLoading(true);
            
            // Use FormData for file uploads
            const formData = new FormData();
            formData.append('image', input); 

            const token = await getToken();
            console.log("🚨 [FRONTEND] Clerk Token retrieved. Sending to backend...");
            
            // Call your backend removeImageBackground controller
            const { data } = await axios.post('/api/ai/remove-image-background', 
                formData,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                } 
            );
        
            console.log("🚨 [FRONTEND] Backend Response:", data);

            if (data.success) {
                // The backend returns the secure_url from Cloudinary
                setContent(data.content);
                toast.success('Background removed successfully!');
            } else {
                toast.error(data.message); 
            }
        } catch (error) {
            console.error("🚨 [FRONTEND] API Error:", error);
            // Enhanced error message extraction to show backend errors clearly
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setLoading(false); 
        }
    }

    return (
        <div className='h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700'>
            
            {/* Left Col */}
            <form onSubmit={onSubmitHandler} className='w-full max-w-lg p-6 bg-white rounded-lg border border-gray-200'>
                <div className='flex items-center gap-3'>
                    <Sparkles className='w-6 text-[#FF4938]'/>
                    <h1 className='text-xl font-semibold'>Background Removal</h1>
                </div>
                
                <p className='mt-6 text-sm font-medium'>Upload image</p>
                <input 
                  onChange={(e) => setInput(e.target.files[0])} 
                  type="file" 
                  accept='image/*' 
                  className='w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300 text-gray-600 cursor-pointer'
                  /* REMOVED: 'required' attribute to prevent browser blocking */
                />
                
                <p className='text-xs text-gray-500 font-light mt-1'>Supports JPG, PNG, and other image formats</p>
                
                {/* ADDED: type="submit" to guarantee form execution */}
                <button type="submit" disabled={loading} className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#F6AB41] to-[#FF4938] text-white px-4 py-3 mt-6 text-sm font-medium rounded-lg cursor-pointer hover:opacity-90 transition disabled:opacity-75 disabled:cursor-not-allowed'>
                    {loading ? (
                        <span className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></span>
                    ) : (
                        <Eraser className='w-5' />
                    )}
                    Remove Background
                </button>
            </form>

            {/* Right Col */}
            <div className='flex-1 min-w-[300px] p-6 bg-white rounded-lg flex flex-col border border-gray-200 min-h-96 max-h-[600px]'>
                <div className='flex items-center gap-3 pb-4 border-b border-gray-100'>
                    <Eraser className='w-6 text-[#FF4938]'/>
                    <h1 className='text-xl font-semibold'>Processed Image</h1>
                </div>
                
                {!content ? (
                    <div className='flex-1 flex justify-center items-center'>
                        <div className='text-sm flex flex-col items-center gap-5 text-gray-400'>
                            <Eraser className='w-16 h-16 opacity-50' />
                            <p className='text-center max-w-xs'>Upload an image and click "Remove background" to get started</p>
                        </div>
                    </div>
                ) : (
                    <div className='mt-4 flex-1 flex justify-center items-center h-full overflow-hidden'>
                        <div className="bg-[url('https://raw.githubusercontent.com/tailwindlabs/tailwindcss/master/tests/fixtures/checkerboard.svg')] bg-repeat rounded-md overflow-hidden flex justify-center items-center h-full w-full border border-gray-200">
                            <img 
                                src={content} 
                                alt="Processed without background" 
                                className='w-full h-auto max-h-full object-contain' 
                            />
                        </div>
                    </div>
                )}
            </div>
            
        </div> 
    )
}

export default RemoveBackground;