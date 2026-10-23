import React, { useEffect, useState } from 'react';
import { Sparkles, Gem, Loader2 } from 'lucide-react'; 
import CreationItem from '../components/CreationItem';
import { useAuth, useUser } from '@clerk/react';
import axios from 'axios';
import toast from 'react-hot-toast';

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const Dashboard = () => {
  const [creations, setCreations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const { getToken } = useAuth();
  
  // Dynamically check if the user has a premium plan
  const isPremium = user?.publicMetadata?.plan === 'premium';

  const getDashboardData = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      const { data } = await axios.get('/api/user/get-user-creations', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.success) {
        setCreations(data.creations);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      getDashboardData();
    }
  }, [user]);
  
  return (
    <div className='h-full overflow-y-scroll p-6 text-slate-700'>
        
        {/* Top Metric Cards */}
        <div className='flex justify-start gap-4 flex-wrap'>
            
            <div className='flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200 shadow-sm'>
                <div className='text-slate-600'>
                    <p className='text-sm'>Total Creations</p>
                    <h2 className='text-xl font-semibold'>
                      {loading ? <Loader2 className='w-5 h-5 animate-spin text-gray-400 mt-1' /> : creations.length}
                    </h2>
                </div>
                
                <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-[#3588F2] to-[#0BB0D7] text-white flex justify-center items-center shadow-md'>
                    <Sparkles className='w-5 text-white' />
                </div>
            </div>

            <div className='flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200 shadow-sm'>
                <div className='text-slate-600'>
                    <p className='text-sm'>Active Plan</p>
                    <h2 className='text-xl font-semibold'>
                        {isPremium ? 'Premium' : 'Free'}
                    </h2>
                </div>

                <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF61C5] to-[#9E53EE] text-white flex justify-center items-center shadow-md'>
                    <Gem className='w-5 text-white' />
                </div>
            </div>

        </div>

        {/* Recent Creations Section */}
        <div className='space-y-3 mt-6'>
          <p className='font-medium text-slate-800 mb-4'>Recent Creations</p>
          
          {loading ? (
            <div className='flex justify-center items-center py-16 bg-white rounded-xl border border-gray-200'>
              <Loader2 className='w-8 h-8 animate-spin text-[#0BB0D7]' />
            </div>
          ) : creations.length === 0 ? (
            <div className='p-8 text-center bg-white rounded-xl border border-gray-200 text-gray-400 text-sm'>
              You haven't created anything yet. Head over to Write Article or Generate Images to get started!
            </div>
          ) : (
            creations.map((item) => <CreationItem key={item.id} item={item}/>)
          )}
        </div>
    </div>
  );
}

export default Dashboard;