import { Eraser, Sparkles, Gem, Lock, ArrowRight } from 'lucide-react';
import React, { useState } from 'react';
import api from '../services/api';
import useSubscriptionPlan from '../hooks/useSubscriptionPlan';
import toast from 'react-hot-toast';
import { isSubscriptionEntitlementError } from '../utils/subscriptionUtils';

const RemoveBackground = () => {

    const [input, setInput] = useState(null);
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState('');

    const { isPremium, openCheckout } = useSubscriptionPlan();

    const onSubmitHandler = async (e) => {
        e.preventDefault();
        
        // Frontend gating check
        if (!isPremium) {
            toast('Background Removal requires Nexora Pro.', {
                icon: '🔒',
                duration: 4000,
            });
            openCheckout();
            return;
        }

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

            // Call backend removeImageBackground controller
            const { data } = await api.post('/api/ai/remove-image-background', formData);

            if (data.success) {
                // The backend returns the secure_url from Cloudinary
                setContent(data.content);
                toast.success('Background removed successfully!');
            } else {
                toast.error(data.message); 
                if (isSubscriptionEntitlementError(data.message)) {
                    openCheckout();
                }
            }
        } catch (error) {
            console.error("🚨 [FRONTEND] API Error:", error);
            const errorMsg = error.response?.data?.message || error.message;
            toast.error(errorMsg);
            if (isSubscriptionEntitlementError(error)) {
                openCheckout();
            }
        } finally {
            setLoading(false); 
        }
    }

    return (
        <div className='h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700'>
            
            {/* Left Col */}
            <form onSubmit={onSubmitHandler} className='w-full max-w-lg p-6 bg-white rounded-lg border border-gray-200'>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                        <Sparkles className='w-6 text-[#FF4938]'/>
                        <h1 className='text-xl font-semibold'>Background Removal</h1>
                    </div>
                    <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-[#9234EA] border border-purple-200'>
                        <Gem className='w-3 h-3' /> Pro Feature
                    </span>
                </div>

                {/* Free plan upgrade banner */}
                {!isPremium && (
                    <div className='mt-4 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 text-slate-700'>
                        <div className='flex items-start gap-3'>
                            <div className='w-8 h-8 rounded-lg bg-[#9234EA]/10 text-[#9234EA] flex items-center justify-center shrink-0 mt-0.5'>
                                <Lock className='w-4 h-4' />
                            </div>
                            <div className='flex-1'>
                                <h2 className='text-sm font-semibold text-slate-900'>Nexora Pro Required</h2>
                                <p className='text-xs text-gray-600 mt-1 leading-relaxed'>
                                    Neural background removal is powered by Cloudinary AI. Subscribe to Nexora Pro ($19/mo) to unlock.
                                </p>
                                <button
                                    type='button'
                                    onClick={() => openCheckout()}
                                    className='mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-[#3C81F6] to-[#9234EA] text-white shadow-sm hover:opacity-95 cursor-pointer'
                                >
                                    Upgrade to Nexora Pro <ArrowRight className='w-3 h-3' />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                <p className='mt-6 text-sm font-medium'>Upload image</p>
                <input 
                  onChange={(e) => setInput(e.target.files[0])} 
                  type="file" 
                  accept='image/*' 
                  className='w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300 text-gray-600 cursor-pointer'
                  /* REMOVED: 'required' attribute to prevent browser blocking */
                />
                
                <p className='text-xs text-gray-500 font-light mt-1'>Supports JPG, PNG, and other image formats</p>
                
                {!isPremium ? (
                    <button
                        type='button'
                        onClick={() => openCheckout()}
                        className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#3C81F6] to-[#9234EA] text-white px-4 py-3 mt-6 text-sm font-medium rounded-lg cursor-pointer shadow hover:opacity-95 transition'
                    >
                        <Lock className='w-4 h-4' /> Upgrade to Nexora Pro to Remove Background
                    </button>
                ) : (
                    <button type="submit" disabled={loading} className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#F6AB41] to-[#FF4938] text-white px-4 py-3 mt-6 text-sm font-medium rounded-lg cursor-pointer hover:opacity-90 transition disabled:opacity-75 disabled:cursor-not-allowed'>
                        {loading ? (
                            <span className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></span>
                        ) : (
                            <Eraser className='w-5' />
                        )}
                        Remove Background
                    </button>
                )}
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