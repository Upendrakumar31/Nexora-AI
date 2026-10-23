import { Scissors, Sparkles } from 'lucide-react'
import React, { useState } from 'react'
import axios from 'axios';
import { useAuth } from '@clerk/react';
import toast from 'react-hot-toast';

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const RemoveObject = () => {

    const [input, setInput] = useState('');
    const [object, setObject] = useState('');
    
    // Added states for loading and result image
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState('');

    const { getToken } = useAuth();
      
    const onSubmitHandler = async (e) => {
        e.preventDefault();
        
        // Manual validation replaces HTML5 'required' for the file input
        if (!input) {
            toast.error("Please select an image first");
            return;
        }
        if (!object) {
            toast.error("Please describe the object to remove");
            return;
        }

        try {
            setLoading(true);
            
            // Use FormData to package the file AND the text prompt together
            const formData = new FormData();
            formData.append('image', input); 
            formData.append('prompt', object); // Sending the object name to the backend

            const token = await getToken();
            
            // Call your backend removeImageObject controller
            const { data } = await axios.post('/api/ai/remove-image-object', 
                formData,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                } 
            );
        
            if (data.success) {
                // The backend returns the inpainted secure_url from Cloudinary
                setContent(data.content);
                toast.success('Object removed successfully!');
            } else {
                toast.error(data.message); 
            }
        } catch (error) {
            console.error("🚨 [FRONTEND] API Error:", error);
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
                    <Sparkles className='w-6 text-[#4A7AFF]'/>
                    <h1 className='text-xl font-semibold'>Object Removal</h1>
                </div>
                
                <p className='mt-6 text-sm font-medium'>Upload image</p>
                <input 
                  onChange={(e) => setInput(e.target.files[0])} 
                  type="file" 
                  accept='image/*' 
                  className='w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300 text-gray-600 cursor-pointer'
                  /* REMOVED: 'required' to prevent native browser blocking */
                />

                <p className='mt-6 text-sm font-medium'>Describe object name to remove</p>
                
                 <textarea 
                    onChange={(e) => setObject(e.target.value)} 
                    value={object}
                    rows={4} 
                    className='w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300 focus:border-[#0BB0D7] transition' 
                    placeholder='e.g., watch or spoon , Only single object name'
                    required 
                />

                {/* ADDED: type="submit" and loading state logic */}
                <button type="submit" disabled={loading} className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#417DF6] to-[#8E37EB] text-white px-4 py-3 mt-6 text-sm font-medium rounded-lg cursor-pointer hover:opacity-90 transition disabled:opacity-75 disabled:cursor-not-allowed'>
                  {loading ? (
                      <span className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></span>
                  ) : (
                      <Scissors className='w-5' />
                  )}
                  Remove Object
                </button>
            </form>

            {/* Right Col */}
            <div className='flex-1 min-w-[300px] p-6 bg-white rounded-lg flex flex-col border border-gray-200 min-h-96 max-h-[600px]'>
                <div className='flex items-center gap-3 pb-4 border-b border-gray-100'>
                    <Scissors className='w-6 text-[#4A7AFF]'/>
                    <h1 className='text-xl font-semibold'>Processed Image</h1>
                </div>

                {!content ? (
                    <div className='flex-1 flex justify-center items-center'>
                        <div className='text-sm flex flex-col items-center gap-5 text-gray-400'>
                            <Scissors className='w-16 h-16 opacity-50' />
                            <p className='text-center max-w-xs'>Upload an image and click "Remove Object" to get started</p>
                        </div>
                    </div>
                ) : (
                    <div className='mt-4 flex-1 flex justify-center items-center h-full overflow-hidden'>
                        <img 
                            src={content} 
                            alt="Processed without object" 
                            className='w-full h-auto max-h-full object-contain rounded-md shadow-sm border border-gray-200' 
                        />
                    </div>
                )}
            </div>
            
        </div> 
    )
}

export default RemoveObject;