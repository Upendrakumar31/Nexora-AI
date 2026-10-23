import React from 'react';
import { useClerk, useUser } from '@clerk/react';
import { Eraser, FileText, Hash, Home, Image as ImageIcon, LogOut, Scissors, Edit, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom'; 

const navItems = [
    {to: '/ai', label: 'Dashboard', Icon: Home},
    {to: '/ai/write-article', label: 'Write Article', Icon: Edit},
    {to: '/ai/blog-titles', label: 'Blog Titles', Icon: Hash},
    {to: '/ai/generate-images', label: 'Generate Images', Icon: ImageIcon},
    {to: '/ai/remove-background', label: 'Remove Background', Icon: Eraser},
    {to: '/ai/remove-object', label: 'Remove Object', Icon: Scissors},
    {to: '/ai/review-resume', label: 'Review Resume', Icon: FileText},
    {to: '/ai/community', label: 'Community', Icon: Users},
]

const Sidebar = ({ sidebar, setSidebar }) => {

    const { user } = useUser();
    const { signOut, openUserProfile } = useClerk()

    // Dynamically check the user's plan from Clerk's public metadata
    const isPremium = user?.publicMetadata?.plan === 'premium';

    // FALLBACK LOGIC: Use fullName, OR the email address, OR a default string
    const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'User';

    return (
        <div className={`w-60 bg-white border-r border-gray-200 flex flex-col justify-between items-center max-sm:absolute top-14 bottom-0 ${sidebar ? 'translate-x-0' : 'max-sm:-translate-x-full'} transition-all duration-300 ease-in-out`}>
            
            <div className='my-7 w-full'>
                <img src={user?.imageUrl} alt="User avatar" className='w-13 rounded-full mx-auto'/>
                
                {/* Updated to use displayName */}
                <h1 className='mt-1 text-center font-semibold text-sm px-2 truncate'>
                    {displayName}
                </h1>
                
                <div className='px-6 mt-5 text-sm text-gray-600 font-medium space-y-2'>
                    {navItems.map(({to, label, Icon})=>(
                        <NavLink key={to} to={to} end={to === '/ai'} onClick={()=>
                        setSidebar(false)} className={({isActive})=> `px-3.5 py-2.5 flex items-center gap-3 rounded transition-all ${isActive ? 'bg-gradient-to-r from-[#3C81F6] to-[#9234EA] text-white' : 'hover:bg-gray-100'}`}>
                            {({ isActive })=>(
                                <>
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                                    {label}
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </div>

            <div className='w-full border-t border-gray-200 p-4 px-7 flex items-center justify-between'>
                
                <div onClick={openUserProfile} className='flex gap-2 items-center cursor-pointer overflow-hidden'>
                    <img src={user?.imageUrl} className='w-8 rounded-full min-w-8' alt="" />
                    <div className='overflow-hidden'>
                        
                        {/* Updated to use displayName */}
                        <h1 className='text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis w-24'>
                            {displayName}
                        </h1>
                        
                        <p className='text-xs font-medium'>
                            {isPremium ? (
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9234EA] to-[#3C81F6]">
                                    Premium Plan
                                </span>
                            ) : (
                                <span className="text-gray-500">Free Plan</span>
                            )}
                        </p>
                        
                    </div>
                </div>
                
                <LogOut onClick={() => signOut()} className='w-4.5 text-gray-400 hover:text-gray-700 transition cursor-pointer min-w-4.5' />
            </div>
            
        </div>
    )
}

export default Sidebar;