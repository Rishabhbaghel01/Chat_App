import React, { Component } from 'react'
import { Form, Icon, Input, Button, Row, Col, List, Avatar, Modal, Select, message, notification, Dropdown, Menu } from 'antd';
import io from "socket.io-client";
import { connect } from "react-redux";
import moment from "moment";
import axios from 'axios';
import { getChats, afterPostMessage, deleteChat } from '../../../_actions/chat_actions';
import ChatCard from './ChatCard';

class ChatPage extends Component {
    state = {
        chatMessage: "",
        users: [],
        allUsers: [],
        groups: [],
        currentGroupId: null,
        searchQuery: "",
        isModalVisible: false,
        newGroupName: "",
        newGroupDescription: "",
        newGroupMembers: [],
        clearChat: false,
        isRemoveModalVisible: false,
        selectedUserToRemove: null
    }

    componentDidMount() {
        let server = "http://localhost:5000";

        this.socket = io(server);

        this.socket.on("Output Chat Message", messageFromBackEnd => {
            const messages = Array.isArray(messageFromBackEnd) ? messageFromBackEnd : [messageFromBackEnd];
            const messageObj = messages[0];
            if (messageObj) {
                const messageGroupId = messageObj.group || 'general';
                if (messageGroupId === this.state.currentGroupId) {
                    this.props.dispatch(afterPostMessage(messages));
                }
            }
        });

        // Join personal user room so the server can send targeted events
        const myId = this.props.user && this.props.user.userData && this.props.user.userData._id;
        if (myId) {
            this.socket.emit("joinUserRoom", { userId: myId });
        }

        // Listen for being removed from a group
        this.socket.on("userRemovedFromGroup", ({ groupId }) => {
            // Remove the group from the local list
            this.setState(prevState => ({
                groups: prevState.groups.filter(g => g._id !== groupId)
            }));
            // If currently viewing that group, force back to general
            if (this.state.currentGroupId === groupId) {
                message.warning('You have been removed from this group.');
                this.handleLeaveGroup();
            }
        });

        // Listen for restored chats when a new message is received
        this.socket.on("chatRestored", ({ group }) => {
            this.setState(prevState => {
                const exists = prevState.groups.some(g => g._id === group._id);
                if (exists) return null;

                // Join the room so we receive real-time messages
                this.socket.emit("joinRoom", { roomId: group._id });

                return {
                    groups: [...prevState.groups, group]
                };
            });
        });

        // Listen for new groups/DMs created where we are a member
        this.socket.on("groupCreated", ({ group }) => {
            this.setState(prevState => {
                const exists = prevState.groups.some(g => g._id === group._id);
                if (exists) return null;

                // Join the room so we receive real-time messages
                this.socket.emit("joinRoom", { roomId: group._id });

                return {
                    groups: [...prevState.groups, group]
                };
            });
        });

        // Fetch registered users
        axios.get('/api/users/getUsers')
            .then(response => {
                this.setState({ users: response.data, allUsers: response.data });
            })
            .catch(err => {
                console.error("Failed to load users:", err);
            });

        // Fetch groups
        axios.get('/api/chat/groups')
            .then(response => {
                this.setState({ groups: response.data });
            })
            .catch(err => {
                console.error("Failed to load groups:", err);
            });
    }

    componentDidUpdate(prevProps) {
        if (this.messagesEnd) {
            this.messagesEnd.scrollIntoView({ behavior: "smooth" });
        }

        const prevId = prevProps.user && prevProps.user.userData && prevProps.user.userData._id;
        const currentId = this.props.user && this.props.user.userData && this.props.user.userData._id;
        if (currentId && currentId !== prevId && this.socket) {
            this.socket.emit("joinUserRoom", { userId: currentId });
        }
    }

    // Updated method name for handling chat input changes
    handleChatMessageChange = (e) => {
        this.setState({
            chatMessage: e.target.value
        });
    }

    // Keep existing typo method for backward compatibility (if any UI still references it)
    hanleSearchChange = this.handleChatMessageChange;

    handleSearchUser = (e) => {
        this.setState({ searchQuery: e.target.value });
    }

    handleGroupSelect = (groupId) => {
        const oldGroupId = this.state.currentGroupId;
        this.setState({ currentGroupId: groupId, clearChat: false }, () => {
            if (oldGroupId && this.socket) {
                this.socket.emit("leaveRoom", { roomId: oldGroupId });
            }
            this.socket.emit("joinRoom", { roomId: groupId });
            this.props.dispatch(getChats(groupId));
        });
    }

    showModal = () => {
        this.setState({
            isModalVisible: true,
            newGroupName: "",
            newGroupDescription: "",
            newGroupMembers: []
        });
    }

    handleCancel = () => {
        this.setState({ isModalVisible: false });
    }

    handleInputChange = (e) => {
        this.setState({ [e.target.name]: e.target.value });
    }

    handleMemberSelect = (selectedValues) => {
        this.setState({ newGroupMembers: selectedValues });
    }

    handleClearChat = () => {
        // Clear displayed chat messages for the current group
        // This simply hides messages in the UI; you may want to extend to notify the server.
        this.setState({ clearChat: true });
    }
    handleRemoveUser = () => {
        const { currentGroupId } = this.state;
        if (currentGroupId === 'general') {
            message.info('Cannot remove a user from the general chat.');
            return;
        }
        this.setState({ isRemoveModalVisible: true, selectedUserToRemove: null });
    };

    handleConfirmRemoveUser = () => {
        const { currentGroupId, selectedUserToRemove } = this.state;
        if (!selectedUserToRemove) {
            message.warning('Please select a user to remove.');
            return;
        }
        axios.put('/api/chat/remove-user', { groupId: currentGroupId, userId: selectedUserToRemove })
            .then(response => {
                if (response.data.success) {
                    message.success('User removed successfully.');
                    this.setState(prevState => ({
                        isRemoveModalVisible: false,
                        selectedUserToRemove: null,
                        users: prevState.users.filter(u => u._id !== selectedUserToRemove)
                    }));
                    axios.get('/api/chat/groups')
                        .then(res => this.setState({ groups: res.data }));
                    const myId = this.props.user && this.props.user.userData && this.props.user.userData._id;
                    if (selectedUserToRemove === myId) {
                        this.handleLeaveGroup();
                    } else {
                        this.props.dispatch(getChats(currentGroupId));
                    }
                } else {
                    message.error(response.data.message || 'Failed to remove user');
                }
            })
            .catch(err => {
                console.error(err);
                message.error('Error removing user');
            });
    };

    handleLeaveGroup = () => {
        const oldGroupId = this.state.currentGroupId;
        this.setState({ currentGroupId: null, clearChat: false }, () => {
            if (oldGroupId && this.socket) {
                this.socket.emit("leaveRoom", { roomId: oldGroupId });
            }
        });
    }

    handleLeaveGroupSidebar = (groupId) => {
        const myId = this.props.user && this.props.user.userData && this.props.user.userData._id;
        if (!myId) return;

        axios.put('/api/chat/remove-user', { groupId, userId: myId })
            .then(response => {
                if (response.data.success) {
                    message.success('Chat removed from sidebar.');
                    this.setState(prevState => ({
                        groups: prevState.groups.filter(g => g._id !== groupId)
                    }));
                    if (this.state.currentGroupId === groupId) {
                        this.handleLeaveGroup();
                    }
                } else {
                    message.error(response.data.message || 'Failed to remove chat');
                }
            })
            .catch(err => {
                console.error(err);
                message.error('Error removing chat');
            });
    }

    handleRemoveUserFromList = (userId) => {
        this.setState(prevState => ({
            users: prevState.users.filter(u => u._id !== userId)
        }), () => {
            message.success('User removed from list.');
        });
    }

    handleCreateGroup = () => {
        const { newGroupName, newGroupDescription, newGroupMembers } = this.state;
        if (!newGroupName.trim()) {
            message.error("Please enter a group name");
            return;
        }

        axios.post('/api/chat/groups/create', {
            name: newGroupName.trim(),
            description: newGroupDescription.trim(),
            members: newGroupMembers
        })
        .then(response => {
            if (response.data.success) {
                message.success("Group created successfully!");
                const newGroup = response.data.group;
                this.setState(prevState => {
                    const exists = prevState.groups.some(g => g._id === newGroup._id);
                    return {
                        groups: exists ? prevState.groups : [...prevState.groups, newGroup],
                        isModalVisible: false
                    };
                }, () => {
                    this.handleGroupSelect(newGroup._id);
                });
            }
        })
        .catch(err => {
            console.error(err);
            message.error("Failed to create group");
        });
    }

    handleSelectUserForDM = (targetUser) => {
        const myId = this.props.user.userData._id;
        if (targetUser._id === myId) return;

        // Find if a 2-member group (DM) already exists with this user
        const existingDM = this.state.groups.find(g => {
            const isDM = g.members && g.members.length === 2;
            if (!isDM) return false;
            const memberIds = g.members.map(m => m._id ? m._id.toString() : m.toString());
            return memberIds.includes(myId) && memberIds.includes(targetUser._id);
        });

        if (existingDM) {
            this.handleGroupSelect(existingDM._id);
        } else {
            axios.post('/api/chat/groups/create', {
                name: `${targetUser.name}`,
                description: `Direct message with ${targetUser.name}`,
                members: [myId, targetUser._id]
            })
            .then(response => {
                if (response.data.success) {
                    const newGroup = response.data.group;
                    this.setState(prevState => {
                        const exists = prevState.groups.some(g => g._id === newGroup._id);
                        return {
                            groups: exists ? prevState.groups : [...prevState.groups, newGroup]
                        };
                    }, () => {
                        this.handleGroupSelect(newGroup._id);
                    });
                }
            })
            .catch(err => {
                console.error("Error creating DM group:", err);
                message.error("Failed to start DM");
            });
        }
    }

    handleEditMessage = (id, currentMessage) => {
        // Placeholder edit functionality – you can replace with a modal or inline edit.
        message.info(`Edit message ${id}`);
    }

    handleDeleteMessage = (id) => {
        this.props.dispatch(deleteChat(id));
    }

    getGroupDisplayName = (group) => {
        if (!group) return "";
        const myId = this.props.user && this.props.user.userData && this.props.user.userData._id;
        const isDM = group.members && group.members.length === 2;
        if (isDM && myId) {
            const otherMember = group.members.find(m => {
                const memberId = m._id ? m._id.toString() : m.toString();
                return memberId !== myId;
            });
            if (otherMember) {
                if (otherMember.name) {
                    return otherMember.name;
                }
                const otherMemberId = otherMember._id ? otherMember._id.toString() : otherMember.toString();
                const otherUser = this.state.users.find(u => u._id === otherMemberId);
                if (otherUser) {
                    return otherUser.name;
                }
            }
        }
        return group.name;
    }

    getChatHeaderName = () => {
        if (this.state.currentGroupId === 'general') {
            return 'General Chatroom';
        }
        const currentGroup = this.state.groups.find(g => g._id === this.state.currentGroupId);
        if (currentGroup) {
            return this.getGroupDisplayName(currentGroup);
        }
        return 'Chat';
    }


    submitChatMessage = (e) => {
        e.preventDefault();

        let chatMessage = this.state.chatMessage;
        if (!chatMessage.trim()) return;

        let userId = this.props.user.userData._id;
        let userName = this.props.user.userData.name;
        let userImage = this.props.user.userData.image;
        let nowTime = moment();
        let type = "Text";
        let groupId = this.state.currentGroupId;

        this.socket.emit("Input Chat Message", {
            chatMessage,
            userId,
            userName,
            userImage,
            nowTime,
            type,
            groupId
        });
        this.setState({ chatMessage: "" })
    }

    renderCards = () =>
        (!this.state.clearChat && this.props.chats.chats && this.props.chats.chats.filter(chat => chat).map((chat) => (
            <ChatCard
                key={chat._id}
                {...chat}
                onDelete={this.handleDeleteMessage}
                onEdit={this.handleEditMessage}
                currentUserId={this.props.user && this.props.user.userData && this.props.user.userData._id}
                isAdmin={this.props.user && this.props.user.userData && this.props.user.userData.role !== 0}
            />
        )));

    render() {
        return (
            <React.Fragment>
                <div>
                    <p style={{ fontSize: '1.4rem', textAlign: 'center', fontWeight: 'bold', margin: '20px 0' }}>
                        Chat Here
                        {this.props.user && this.props.user.userData && (
                            <span style={{ fontSize: '1rem', fontWeight: 'normal', color: '#8c8c8c', marginLeft: '10px' }}>
                                (Logged in as: <strong>{this.props.user.userData.name}</strong>)
                            </span>
                        )}
                    </p>
                </div>

                <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
                    <Row>
                        <Col span={7}>
                            <div style={{
                                border: '1px solid #e8e8e8',
                                borderRadius: '8px',
                                padding: '16px',
                                backgroundColor: '#fafafa',
                                height: '500px',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                            }}>
                                {this.props.user && this.props.user.userData && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '10px',
                                        backgroundColor: '#fff',
                                        border: '1px solid #e8e8e8',
                                        borderRadius: '8px',
                                        marginBottom: '16px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}>
                                        <Avatar 
                                            size="large"
                                            src={this.props.user.userData.image || 'https://zos.alipayobjects.com/rmsportal/ODTLcjxAfvqbxHnVXCYX.png'} 
                                            style={{ marginRight: '12px' }}
                                        />
                                        <div style={{ overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#262626', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                {this.props.user.userData.name}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#8c8c8c', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                {this.props.user.userData.email}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <Input.Search
                                    placeholder="Search users..."
                                    value={this.state.searchQuery}
                                    onChange={this.handleSearchUser}
                                    style={{ marginBottom: '16px' }}
                                    allowClear
                                />

                                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#262626' }}>Chats & Conversations</span>
                                    <Button 
                                        type="primary" 
                                        shape="circle" 
                                        icon={<Icon type="plus" />} 
                                        size="small" 
                                        onClick={this.showModal}
                                    />
                                </div>

                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    {this.state.groups
                                        .filter(g => g._id !== 'general')
                                        .map(group => {
                                            const isSelected = this.state.currentGroupId === group._id;
                                            const isDM = group.members && group.members.length === 2;
                                            const groupMenu = (
                                                <Menu>
                                                    <Menu.Item key="leave" onClick={(e) => {
                                                        e.domEvent.stopPropagation();
                                                        this.handleLeaveGroupSidebar(group._id);
                                                    }}>
                                                        <span style={{ color: '#ff4d4f' }}>Remove Chat</span>
                                                    </Menu.Item>
                                                </Menu>
                                            );
                                            return (
                                                <div 
                                                    key={group._id}
                                                    onClick={() => this.handleGroupSelect(group._id)}
                                                    style={{
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
                                                        fontWeight: isSelected ? 'bold' : 'normal',
                                                        color: isSelected ? '#1890ff' : '#595959',
                                                        marginBottom: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {isDM ? <Icon type="message" style={{ marginRight: '8px' }} /> : <Icon type="team" style={{ marginRight: '8px' }} />}
                                                        {this.getGroupDisplayName(group)}
                                                    </div>
                                                    <Dropdown overlay={groupMenu} trigger={['click']}>
                                                        <Icon 
                                                            type="ellipsis" 
                                                            onClick={(e) => e.stopPropagation()} 
                                                            style={{ fontSize: '16px', padding: '4px', cursor: 'pointer' }} 
                                                        />
                                                    </Dropdown>
                                                </div>
                                            )
                                        })
                                    }

                                    {this.state.groups.filter(g => g._id !== 'general').length > 0 && this.state.users.filter(u => {
                                        const isMe = this.props.user && this.props.user.userData && u._id === this.props.user.userData._id;
                                        return !isMe;
                                    }).length > 0 && (
                                        <div style={{ borderTop: '1px solid #f0f0f0', margin: '12px 0 8px 0' }} />
                                    )}

                                    <List
                                        split={false}
                                        dataSource={(() => {
                                            const sourceList = this.state.searchQuery ? this.state.allUsers : this.state.users;
                                            return sourceList.filter(user => {
                                                const nameMatch = user.name && user.name.toLowerCase().includes(this.state.searchQuery.toLowerCase());
                                                const emailMatch = user.email && user.email.toLowerCase().includes(this.state.searchQuery.toLowerCase());
                                                const matchesSearch = nameMatch || emailMatch;
                                                const isMe = this.props.user && this.props.user.userData && user._id === this.props.user.userData._id;
                                                if (!matchesSearch || isMe) return false;

                                                // Filter out users who already have an active DM chat in the groups list
                                                const myId = this.props.user && this.props.user.userData && this.props.user.userData._id;
                                                if (myId) {
                                                    const hasDM = this.state.groups.some(g => {
                                                        const isDM = g.members && g.members.length === 2;
                                                        if (!isDM) return false;
                                                        const memberIds = g.members.map(m => m._id ? m._id.toString() : m.toString());
                                                        return memberIds.includes(myId) && memberIds.includes(user._id);
                                                    });
                                                    if (hasDM) return false;
                                                }
                                                return true;
                                            });
                                        })()}
                                        renderItem={item => {
                                            const userMenu = (
                                                <Menu>
                                                    <Menu.Item key="removeUser" onClick={(e) => {
                                                        e.domEvent.stopPropagation();
                                                        this.handleRemoveUserFromList(item._id);
                                                    }}>
                                                        <span style={{ color: '#ff4d4f' }}>Remove User</span>
                                                    </Menu.Item>
                                                </Menu>
                                            );
                                            return (
                                                <List.Item 
                                                    onClick={() => this.handleSelectUserForDM(item)}
                                                    style={{
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                        margin: '2px 0',
                                                        cursor: 'pointer',
                                                        border: 'none',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    className="user-list-item"
                                                >
                                                    <List.Item.Meta
                                                        avatar={<Avatar size="small" src={item.image || 'https://zos.alipayobjects.com/rmsportal/ODTLcjxAfvqbxHnVXCYX.png'} />}
                                                        title={<span style={{ fontSize: '0.85rem', color: '#595959' }}>{item.name}</span>}
                                                    />
                                                    <Dropdown overlay={userMenu} trigger={['click']}>
                                                        <Icon 
                                                            type="ellipsis" 
                                                            onClick={(e) => e.stopPropagation()} 
                                                            style={{ fontSize: '16px', padding: '4px', cursor: 'pointer' }} 
                                                        />
                                                    </Dropdown>
                                                </List.Item>
                                            );
                                        }}
                                    />
                                </div>
                            </div>
                        </Col>

                        <Col span={17} style={{display: 'flex', flexDirection: 'column', height: '500px'}}>
                            {this.state.currentGroupId ? (
                                <React.Fragment>
                                    <div style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#1890ff',
                                        color: '#fff',
                                        borderRadius: '8px 8px 0 0',
                                        fontWeight: 'bold',
                                        fontSize: '1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <span>
                                            <Icon type="appstore" style={{ marginRight: '8px' }} />
                                            {this.getChatHeaderName()}
                                        </span>
                                        <Button type="default" onClick={this.handleClearChat} style={{ marginLeft: '8px' }}>
                                            Clear Chat
                                        </Button>
                                    </div>

                                    <div style={{
                                        flex: 1,
                                        overflowY: 'auto',
                                        borderLeft: '1px solid #e8e8e8',
                                        borderRight: '1px solid #e8e8e8',
                                        borderBottom: '1px solid #e8e8e8',
                                        padding: '16px',
                                        backgroundColor: '#fff',
                                        marginBottom: '16px',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
                                    }}>
                                        {this.props.chats && (
                                            <div>{this.renderCards()}</div>
                                        )}
                                        <div
                                            ref={el => {
                                                this.messagesEnd = el;
                                            }}
                                            style={{ float: "left", clear: "both" }}
                                        />
                                    </div>

                                    <Row>
                                        <Form layout="inline" style={{ display: 'flex', width: '100%' }} onSubmit={e => e.preventDefault()}>
                                            <Col span={20} style={{ paddingRight: '8px' }}>
                                                <Input
                                                    id="message"
                                                    prefix={<Icon type="message" style={{ color: 'rgba(0,0,0,.25)' }} />}
                                                    placeholder="Start your conversation"
                                                    type="text"
                                                    value={this.state.chatMessage}
                                                    onChange={this.handleChatMessageChange}
                                                    onPressEnter={this.submitChatMessage}
                                                />
                                            </Col>
                                            <Col span={4}>
                                                <Button type="primary" style={{ width: '100%', borderRadius: '4px' }} onClick={this.submitChatMessage} htmlType="button">
                                                    <Icon type="send" /> Send
                                                </Button>
                                            </Col>
                                        </Form>
                                    </Row>
                                </React.Fragment>
                            ) : (
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid #e8e8e8',
                                    borderRadius: '8px',
                                    backgroundColor: '#fafafa',
                                    padding: '32px',
                                    textAlign: 'center'
                                }}>
                                    <Icon type="message" style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                                    <h3 style={{ color: '#262626', fontWeight: 'bold' }}>Welcome to Chat App</h3>
                                    <p style={{ color: '#8c8c8c', maxWidth: '300px' }}>Select a group or a registered user from the sidebar to start a conversation.</p>
                                </div>
                            )}
                        </Col>
                    </Row>
                </div>

                <Modal
                    title="Create a New Group"
                    visible={this.state.isModalVisible}
                    onOk={this.handleCreateGroup}
                    onCancel={this.handleCancel}
                    okText="Create"
                    cancelText="Cancel"
                >
                    <Form layout="vertical">
                        <Form.Item label="Group Name">
                            <Input
                                name="newGroupName"
                                value={this.state.newGroupName}
                                onChange={this.handleInputChange}
                                placeholder="e.g. Project Team"
                            />
                        </Form.Item>
                        <Form.Item label="Description (Optional)">
                            <Input
                                name="newGroupDescription"
                                value={this.state.newGroupDescription}
                                onChange={this.handleInputChange}
                                placeholder="What is this group about?"
                            />
                        </Form.Item>
                        <Form.Item label="Select Members" extra="Start typing a name to search for users">
                            <Select
                                mode="multiple"
                                style={{ width: '100%' }}
                                placeholder="Search and select members..."
                                value={this.state.newGroupMembers}
                                onChange={this.handleMemberSelect}
                                filterOption={(input, option) =>
                                    option.props.children[1]
                                        .toLowerCase()
                                        .indexOf(input.toLowerCase()) >= 0
                                }
                                optionLabelProp="label"
                            >
                                {this.state.users
                                    .filter(user => this.props.user.userData && user._id !== this.props.user.userData._id)
                                    .map(user => (
                                        <Select.Option key={user._id} value={user._id} label={user.name}>
                                            <Avatar size="small" src={user.image || 'https://zos.alipayobjects.com/rmsportal/ODTLcjxAfvqbxHnVXCYX.png'} style={{ marginRight: '8px' }} />
                                            {user.name}
                                        </Select.Option>
                                    ))
                                }
                            </Select>
                        </Form.Item>
                    </Form>
                </Modal>

                <Modal
                    title="Remove User from Group"
                    visible={this.state.isRemoveModalVisible}
                    onOk={this.handleConfirmRemoveUser}
                    onCancel={() => this.setState({ isRemoveModalVisible: false, selectedUserToRemove: null })}
                    okText="Remove"
                    okButtonProps={{ type: 'danger' }}
                    cancelText="Cancel"
                >
                    <p>Select a member to remove from this group:</p>
                    <Select
                        style={{ width: '100%' }}
                        placeholder="Select a member..."
                        value={this.state.selectedUserToRemove}
                        onChange={val => this.setState({ selectedUserToRemove: val })}
                    >
                        {(() => {
                            const currentGroup = this.state.groups.find(g => g._id === this.state.currentGroupId);
                            const memberIds = currentGroup && currentGroup.members 
                                ? currentGroup.members.map(m => m._id ? m._id.toString() : m.toString()) 
                                : [];
                            return this.state.users
                                .filter(u => memberIds.indexOf(u._id) !== -1)
                                .map(user => (
                                    <Select.Option key={user._id} value={user._id}>
                                        <Avatar size="small" src={user.image || 'https://zos.alipayobjects.com/rmsportal/ODTLcjxAfvqbxHnVXCYX.png'} style={{ marginRight: '8px' }} />
                                        {user.name}
                                    </Select.Option>
                                ));
                        })()}
                    </Select>
                </Modal>
            </React.Fragment>
        )
    }
}

const mapStateToProps = state => {
    return {
        user: state.user,
        chats: state.chat
    }
}

export default connect(mapStateToProps)(ChatPage);