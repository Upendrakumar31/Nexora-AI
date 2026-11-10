import React from 'react'
import { useState } from 'react'
import Markdown from 'react-markdown'
import { parseBlogTitles } from '../utils/titleParser'

const CreationItem = ({item}) => {

    const [expanded, setExpanded] = useState(false);
    const blogTitles = item.type === 'blog-title' ? parseBlogTitles(item.content) : [];
  return (
    <div onClick={()=> setExpanded(!expanded)}className='p-4 max-w-5xl text-sm bg-white border
    border-gray-200 rounded-lg cursor-pointer'>
        <div className='flex justify-between items-center gap-4'>
            <div>
                <h2>{item.prompt}</h2>
                <p className='text-gray-500'>{item.type} - {new Date(item.
                    created_at).toLocaleDateString()}</p>
            </div>
            <button className='bg-[#EFF6FF] border border-[#BFDBFE] text-[#1E40AF]
            px-4 py-1 rounded-full'>{item.type}</button>

        </div>
      {
        expanded && (
            <div>
                {item.type === 'image' ?(
                    <div>
                        <img src = {item.content} alt="image" className='mt-3 w-full max-w-md' />
                    </div>
                ) : item.type === 'blog-title' && blogTitles.length > 0 ? (
                    <div className='mt-3 space-y-2'>
                        {blogTitles.map((title, idx) => (
                            <div key={idx} className='p-2.5 bg-purple-50/50 border border-purple-100 rounded-md flex items-start gap-2.5 text-xs text-slate-700'>
                                <span className='w-5 h-5 rounded-full bg-[#8E37EB] text-white flex items-center justify-center font-semibold text-[10px] flex-shrink-0 mt-0.5'>
                                    {idx + 1}
                                </span>
                                <span className='font-medium leading-relaxed'>{title}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className='mt-3 h-full overflow-y-scroll text-sm
                    text-slate-700'> 
                        <div className='reset-tw'>
                            <Markdown>
                                {item.content}
                            </Markdown>
                            
                        </div>
                    </div>
                )}
            </div>
        )
      }
    </div>
  )
}

export default CreationItem
