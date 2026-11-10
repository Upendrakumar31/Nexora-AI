import React, { useEffect, useState } from 'react';
import { Sparkles, Gem, Loader2, ArrowUpRight } from 'lucide-react'; 
import CreationItem from '../components/CreationItem';
import { useUser } from '@clerk/react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useSubscriptionPlan } from '../hooks/useSubscriptionPlan';

const Dashboard = () => {
  const [creations, setCreations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const { isPremium, openCheckout, manageSubscription } = useSubscriptionPlan();

  const getDashboardData = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/user/get-user-creations');

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
                    <p className='text-sm font-medium text-gray-500'>Total Creations</p>
                    <h2 className='text-xl font-bold mt-1 text-slate-800'>
                      {loading ? <Loader2 className='w-5 h-5 animate-spin text-gray-400 mt-1' /> : creations.length}
                    </h2>
                </div>
                
                <div className='w-10 h-10 rounded-lg bg-gradient-to-br from-[#3588F2] to-[#0BB0D7] text-white flex justify-center items-center shadow-md'>
                    <Sparkles className='w-5 text-white' />
                </div>
            </div>

            <div className='flex justify-between items-center w-72 p-4 px-6 bg-white rounded-xl border border-gray-200 shadow-sm'>
                <div className='text-slate-600'>
                    <div className='flex items-center gap-2'>
                      <p className='text-sm font-medium text-gray-500'>Active Plan</p>
                      {!isPremium ? (
                        <button
                          onClick={() => openCheckout()}
                          className='text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 font-semibold inline-flex items-center gap-0.5 cursor-pointer'
                        >
                          Upgrade <ArrowUpRight className='w-2.5 h-2.5' />
                        </button>
                      ) : (
                        <button
                          onClick={manageSubscription}
                          className='text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium inline-flex items-center gap-0.5 cursor-pointer'
                        >
                          Manage
                        </button>
                      )}
                    </div>
                    <h2 className='text-xl font-bold mt-1'>
                        {isPremium ? (
                          <span className='text-transparent bg-clip-text bg-gradient-to-r from-[#FF61C5] to-[#9E53EE]'>
                            Nexora Pro
                          </span>
                        ) : (
                          <span className='text-slate-800'>Free Plan</span>
                        )}
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
