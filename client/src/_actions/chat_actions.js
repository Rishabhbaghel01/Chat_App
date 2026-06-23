import axios from 'axios';
import {
    GET_CHATS,
    AFTER_POST_MESSAGE,
    DELETE_CHAT
} from './types';
import { CHAT_SERVER } from '../components/Config.js';

export function getChats(groupId){
    const url = groupId ? `${CHAT_SERVER}/getChats?groupId=${groupId}` : `${CHAT_SERVER}/getChats`;
    const request = axios.get(url)
        .then(response => response.data);
    
    return {
        type: GET_CHATS,
        payload: request
    }
}

export function afterPostMessage(data){
    
    return {
        type: AFTER_POST_MESSAGE,
        payload: data
    }
}
export function deleteChat(id){
    const request = axios.delete(`${CHAT_SERVER}/delete/${id}`)
        .then(response => response.data);
    return {
        type: DELETE_CHAT,
        payload: request
    };
}
