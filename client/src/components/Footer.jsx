import React from 'react';
import { assets } from '../assets/assets';

const Footer = () => {
  return (
    <footer className="px-6 md:px-16 lg:px-24 xl:px-32 pt-8 w-full text-gray-500 mt-20">
      
      <div className="flex flex-col md:flex-row justify-between w-full gap-10 border-b border-gray-500/30 pb-6">
        
        <div className="md:max-w-96">
          <img className="h-9" src={assets.logo} alt="logo" />
          
          <p className="mt-6 text-sm leading-relaxed">
            Experience the power of AI with QuickAi. <br />
            Transform your content creation with our suite of premium AI tools. Write articles, generate images, and enhance your workflow.
          </p>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row items-start md:justify-end gap-10 md:gap-20">
          
          <div className="flex flex-col text-sm space-y-3">
            <h2 className="font-semibold mb-3 text-gray-800 text-base">Company</h2>
            <a className="hover:text-gray-800 transition" href="#">Home</a>
            <a className="hover:text-gray-800 transition" href="#">About us</a>
            <a className="hover:text-gray-800 transition" href="#">Contact us</a>
            <a className="hover:text-gray-800 transition" href="#">Privacy policy</a>
          </div>

          <div>
            <h2 className="font-semibold text-gray-800 mb-5 text-base">Subscribe to our newsletter</h2>
            <div className="text-sm space-y-4 max-w-sm">
              <p>The latest news, articles, and resources, sent to your inbox weekly.</p>
              <div className="flex items-center gap-2">
                <input 
                  className="bg-white outline-none w-full py-2 rounded border border-gray-300 px-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" 
                  type="email" 
                  placeholder="Enter your email" 
                />
                <button className="bg-primary hover:bg-blue-700 transition px-6 py-2 text-white rounded font-medium cursor-pointer">
                  Subscribe
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <p className="py-6 text-center text-sm">
        Copyright 2026 © SRX. All Right Reserved.
      </p>
      
    </footer>
  );
};

export default Footer;