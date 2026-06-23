import {
    GET_CHATS,
    AFTER_POST_MESSAGE,
    DELETE_CHAT
} from '../_actions/types';
 

export default function(state={},action){
    switch(action.type){
        case GET_CHATS:
            return {...state, chats: action.payload }

        case AFTER_POST_MESSAGE:
            // Append incoming chat(s) to the existing list for real‑time updates
            return {
                ...state,
                chats: [...(state.chats || []), ...(action.payload || [])]
            };

        case DELETE_CHAT:
            // Remove the deleted chat from the list
            return { 
                ...state, 
                chats: state.chats ? state.chats.filter(chat => chat && action.payload && chat._id !== action.payload._id) : [] 
            }
        
        default:
            return state;
    }
}