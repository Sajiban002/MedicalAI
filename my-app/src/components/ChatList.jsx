// import React, { useEffect, useState } from 'react';
// import axios from 'axios';
// import io from 'socket.io-client';

// // Указываем полные URL с портами
// const API_URL = 'http://localhost:5001';
// const SOCKET_URL = 'http://localhost:5001';

// const socket = io(SOCKET_URL);

// const ChatList = () => {
//   const [chats, setChats] = useState([]);
//   const [selectedChat, setSelectedChat] = useState(null);
//   const [messages, setMessages] = useState([]);
//   const [messageInput, setMessageInput] = useState('');

//   // Загружаем список чатов
//   useEffect(() => {
//     const fetchChats = async () => {
//       const token = localStorage.getItem('token');
//       try {
//         const res = await axios.get(`${API_URL}/api/chat`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         setChats(res.data);
//       } catch (error) {
//         console.error('Ошибка загрузки чатов:', error);
//       }
//     };

//     fetchChats();
//   }, []);

//   // Открытие чата
//   const openChat = async (chatRoom) => {
//     setSelectedChat(chatRoom);
//     setMessages([]);
//     socket.emit('joinRoom', chatRoom.id);

//     const token = localStorage.getItem('token');
//     try {
//       const res = await axios.get(`${API_URL}/api/chat/${chatRoom.id}/messages`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       setMessages(res.data);
//     } catch (error) {
//       console.error('Ошибка загрузки сообщений:', error);
//     }
//   };

//   // Отправка сообщения
//   const sendMessage = () => {
//     if (!selectedChat || selectedChat.is_locked) return;

//     const msg = {
//       chatRoomId: selectedChat.id,
//       content: messageInput,
//     };

//     const token = localStorage.getItem('token');
//     socket.emit('sendMessage', { ...msg, token });

//     setMessages((prev) => [...prev, { content: messageInput, from_self: true }]);
//     setMessageInput('');
//   };

//   // Обработка нового сообщения
//   useEffect(() => {
//     const handleNewMessage = (msg) => {
//       if (msg.chatRoomId === selectedChat?.id) {
//         setMessages((prev) => [...prev, msg]);
//       }
//     };

//     if (selectedChat) {
//       socket.on('newMessage', handleNewMessage);
//     }

//     // Очистка подписки на событие при изменении selectedChat
//     return () => {
//       socket.off('newMessage', handleNewMessage);
//     };
//   }, [selectedChat]);

//   return (
//     <div>
//       <h2>Мои чаты</h2>
//       <ul>
//         {chats.map(chat => (
//           <li key={chat.id} onClick={() => openChat(chat)}>
//             {chat.partnerName}
//           </li>
//         ))}
//       </ul>

//       {selectedChat && (
//         <div className="modal">
//           <h3>Чат с {selectedChat.partnerName}</h3>
//           <div className="chat-messages">
//             {messages.map((msg, i) => (
//               <p key={i} style={{ textAlign: msg.from_self ? 'right' : 'left' }}>
//                 {msg.content}
//               </p>
//             ))}
//           </div>
//           {!selectedChat.is_locked && (
//             <>
//               <input
//                 value={messageInput}
//                 onChange={(e) => setMessageInput(e.target.value)}
//               />
//               <button onClick={sendMessage}>Отправить</button>
//             </>
//           )}
//           {selectedChat.is_locked && <p>Чат закрыт</p>}
//         </div>
//       )}
//     </div>
//   );
// };

// export default ChatList;
