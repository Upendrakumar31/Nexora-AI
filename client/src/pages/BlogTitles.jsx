import { Hash, Sparkles, Copy, Check, Gem } from 'lucide-react'
import React, { useState } from 'react'
import api from '../services/api'
import useSubscriptionPlan from '../hooks/useSubscriptionPlan'
import toast from 'react-hot-toast';
import Markdown from 'react-markdown';
import { parseBlogTitles } from '../utils/titleParser';
import { isSubscriptionEntitlementError } from '../utils/subscriptionUtils';

const BlogTitles = () => {

  const blogCategories = [ 'General', 'Technology', 'Business', 'Health', 'Lifestyle', 
    'Education', 'Travel', 'Food']
  
  const [selectedCategory, setSelectedCategory] = useState('General')
  const [input, setInput]=  useState('')
  const [loading, setLoading] = useState(false)  
  const [content, setContent] = useState('') 
  const [copiedIndex, setCopiedIndex] = useState(null)

  const { isPremium, openCheckout } = useSubscriptionPlan();

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      // Crafting a highly specific prompt to get the best results from the Groq API
      const prompt = `Generate 5 catchy, engaging, and SEO-friendly blog titles about "${input}" specifically for the ${selectedCategory} category. Format them clearly as a list.`;
      
      // Pointing to the generateBlogTitle controller in your backend
      const { data } = await api.post('/api/ai/generate-blog-title', 
        { prompt }
      );
    
      if (data.success) {
        setContent(data.content);
        setCopiedIndex(null);
      } else {
        toast.error(data.message); 
        if (isSubscriptionEntitlementError(data.message)) {
          openCheckout();
        }
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      toast.error(errorMsg);
      if (isSubscriptionEntitlementError(error)) {
        openCheckout();
      }
    } finally {
      setLoading(false); 
    }
  }

  const handleCopy = (title, index) => {
    if (!navigator?.clipboard?.writeText) {
      toast.error("Clipboard copy not supported");
      return;
    }
    navigator.clipboard.writeText(title);
    setCopiedIndex(index);
    toast.success("Title copied to clipboard!");
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  }

  const titles = parseBlogTitles(content);

  return (
    <div className='h-full overflow-y-scroll p-6 flex items-start flex-wrap gap-4 text-slate-700'>
        {/* left col */}
        <form onSubmit={onSubmitHandler} className='w-full max-w-lg p-4 bg-white rounded-lg border border-gray-200'>
            <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                    <Sparkles className='w-6 text-[#8E37EB]'/>
                    <h1 className='text-xl font-semibold'>AI Title Generator</h1>
                </div>
                {isPremium ? (
                    <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-[#9234EA] border border-purple-200'>
                        <Gem className='w-3 h-3' /> Nexora Pro
                    </span>
                ) : (
                    <span className='text-xs text-gray-500 font-medium bg-gray-100 px-2.5 py-0.5 rounded-full'>
                        10 Free Generations
                    </span>
                )}
            </div>
            
            <p className='mt-6 text-sm font-medium'>Keyword</p>
            <input onChange={(e)=>setInput(e.target.value)} value={input} type="text" className='w-full p-2 px-3 mt-2 outline-none text-sm rounded-md border border-gray-300' placeholder='The future of artificial intelligence is...' required/>

            <p className='mt-4 text-sm font-medium'>Category</p>
            <div className='mt-3 flex gap-3 flex-wrap sm:max-w-9/11'>
              {blogCategories.map((item) => (
                <span onClick={()=> setSelectedCategory(item)}
                className={`text-xs px-4 py-1 border rounded-full cursor-pointer ${selectedCategory === item ?  'bg-purple-50 text-purple-700': 'text-gray-500 border-gray-300'}`}
                 key={item}>{item}</span>
              ))}
            </div>
            <br/>
            
            <button disabled={loading} className='w-full flex justify-center items-center gap-2 bg-gradient-to-r from-[#C341F6] to-[#8E37EB] text-white px-4 py-2 mt-6 text-sm rounded-lg cursor-pointer'>
              {
                loading ? <span className='w-4 h-4 my-1 rounded-full border-2 border-t-transparent animate-spin'></span>
                : <Hash className='w-5' />
              }
              Generate title
            </button>
        </form>

        {/*Right col */}
        <div className='w-full max-w-lg p-4 bg-white rounded-lg flex flex-col border border-gray-200 min-h-96 max-h-[600px]'>
          <div className='flex items-center gap-3'>
            <Hash  className='w-5 h-5 text-[#8E37EB]'/>
            <h1 className='text-lg font-semibold text-slate-800'>Generated titles</h1>
          </div>
          
          {!content ? (
            <div className='flex-1 flex justify-center items-center'>
              <div className='text-sm flex flex-col items-center gap-5 text-gray-400'>
                <Hash className='w-9 h-9' />
                <p>Enter a topic and click "Generate title" to get started</p>
              </div>
             </div>
          ) : titles.length > 0 ? (
            <div className='mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1'>
              {titles.map((title, index) => (
                <div 
                  key={index} 
                  className='p-3 bg-purple-50/50 hover:bg-purple-50 border border-purple-100 rounded-lg flex items-start gap-3 transition-colors group'
                >
                  <span className='flex-shrink-0 w-6 h-6 rounded-full bg-[#8E37EB] text-white text-xs font-semibold flex items-center justify-center mt-0.5 shadow-sm'>
                    {index + 1}
                  </span>
                  <p className='text-sm text-slate-700 font-medium flex-1 leading-snug'>{title}</p>
                  <button
                    type='button'
                    onClick={() => handleCopy(title, index)}
                    className='text-gray-400 hover:text-[#8E37EB] transition-colors p-1 rounded hover:bg-white'
                    title='Copy title'
                  >
                    {copiedIndex === index ? (
                      <Check className='w-4 h-4 text-green-600' />
                    ) : (
                      <Copy className='w-4 h-4' />
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className='mt-3 h-full overflow-y-scroll text-sm text-slate-600'>
              <div className='reset-tw'>
                <Markdown>{content}</Markdown>
              </div>
            </div>
          )}
          
        </div>
    </div>
  )
}

export default BlogTitles