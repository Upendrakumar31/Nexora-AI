import React, { useState } from 'react' 
import { Outlet, useNavigate } from 'react-router-dom'
import { assets } from '../assets/assets'
import { Menu, X } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { SignIn, useUser } from '@clerk/react'

const Layout = () => {
  const navigate = useNavigate()
  const [sidebar, setSidebar] = useState(false)
  const { user } = useUser()

  return user ? (
    <div className='flex flex-col items-start justify-start h-screen'>
      
      
      <nav className='flex items-center justify-between w-full p-4 border-b h-16'>
        <img 
          src={assets.logo} 
          alt="logo" 
          className='w-32 sm:w-44 cursor-pointer'
          onClick={() => navigate('/')} 
        />
        <div onClick={() => setSidebar(prev => !prev)} className='cursor-pointer'>
          {
            sidebar 
              ? <X className='w-6 h-6 text-gray-600 sm:hidden'/>
              : <Menu className='w-6 h-6 text-gray-600 sm:hidden'/>
          }
        </div>
      </nav>
      
      
      <div className='flex-1 w-full flex h-[calc(100vh-64px)]'>
        <Sidebar sidebar={sidebar} setSidebar={setSidebar} />
        
        <div className='flex-1 bg-[#F4F7FB] overflow-y-auto'>
          <Outlet />
        </div>
      </div>
      
    </div>
  ) : (
    
   
    <div className='flex items-center justify-center h-screen'>
      <SignIn routing="hash" />
    </div>
  )
}

export default Layout