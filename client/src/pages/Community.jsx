import { useAuth, useUser } from '@clerk/react'
import React, { useEffect, useState } from 'react'
import { Heart, Loader2 } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

axios.defaults.baseURL = import.meta.env.VITE_BASE_URL;

const Community = () => {
  const [creations, setCreations] = useState([]);
  const { user } = useUser();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);

  const fetchCreations = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      const { data } = await axios.get('/api/user/get-published-creations', {
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

  const handleLike = async (id) => {
    if (!user) return;

    try {
      const token = await getToken();
      
      const { data } = await axios.post('/api/user/toggle-like-creation', 
        { id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        const updatedLikes = data.likes || [];
        
        // Safely check if current user's ID exists in the updated array using string casting
        const isNowLiked = updatedLikes.some(uid => String(uid) === String(user.id));

        if (isNowLiked) {
          toast.success("Creation liked");
        } else {
          toast.success("Creation unlinked");
        }

        // Optimistically update the UI creations state
        setCreations(prev => prev.map(item => {
          if (item.id === id) {
            return { ...item, likes: updatedLikes };
          }
          return item;
        }));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCreations();
    }
  }, [user]);

  return (
    <div className='flex-1 h-full flex flex-col gap-4 p-6 text-slate-700'>
      <h1 className='text-xl font-semibold'>Community Creations</h1>
      
      <div className='bg-white h-full w-full rounded-xl overflow-y-scroll p-4 shadow-sm border border-gray-200'>
        {loading ? (
          <div className='h-full flex justify-center items-center'>
            <Loader2 className='w-8 h-8 animate-spin text-[#0BB0D7]' />
          </div>
        ) : creations.length === 0 ? (
          <div className='h-full flex justify-center items-center text-gray-400 text-sm'>
            No public creations found yet. Generate an image and toggle "Make this image public"!
          </div>
        ) : (
          <div className='columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4'>
            {creations.map((creation) => {
              const likesArray = creation.likes || [];
              // Robust check ensuring type compatibility between database elements and user.id
              const isLiked = user && likesArray.some(uid => String(uid) === String(user.id));

              return (
                <div key={creation.id} className='relative group break-inside-avoid rounded-lg overflow-hidden shadow-md border border-gray-100'>
                  <img src={creation.content} alt="Community upload" className='w-full object-cover rounded-lg' />

                  <div className='absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-b from-transparent via-transparent to-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                    <p className='text-xs line-clamp-2 mb-2'>{creation.prompt}</p>
                    <div className='flex justify-between items-center'>
                      <span className='text-[10px] text-gray-300 uppercase tracking-wider'>{creation.type}</span>
                      <div className='flex gap-1.5 items-center cursor-pointer' onClick={() => handleLike(creation.id)}>
                        <span className='text-xs font-medium'>{likesArray.length}</span>
                        <Heart className={`w-5 h-5 transition-transform hover:scale-110 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Community;