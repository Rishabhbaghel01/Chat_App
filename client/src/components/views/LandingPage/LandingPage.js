import React, { useState, useEffect } from 'react';
import { FaCode } from "react-icons/fa";
import { useSelector } from "react-redux";
import { Input, Button, Modal, Typography, message, Card } from 'antd';
import axios from 'axios';
import { USER_SERVER } from '../../Config.js';
import { withRouter } from 'react-router-dom';

const { Title } = Typography;

function LandingPage(props) {
    const user = useSelector(state => state.user);
    const [name, setName] = useState('');
    const [lastname, setLastname] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    useEffect(() => {
        if (user.userData && user.userData.isAuth) {
            setName(user.userData.name || '');
            setLastname(user.userData.lastname || '');
        }
    }, [user.userData]);

    const onUpdate = (e) => {
        e.preventDefault();
        if (!name || !lastname) {
            return message.error('Please input your first and last name!');
        }
        axios.put(`${USER_SERVER}/update`, { name, lastname })
            .then(response => {
                if (response.data.success) {
                    message.success('Profile updated successfully');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    message.error('Failed to update profile');
                }
            })
            .catch(err => message.error('Failed to update profile'));
    };

    const showDeleteConfirm = () => {
        setIsModalVisible(true);
    };

    const handleDelete = () => {
        axios.delete(`${USER_SERVER}/delete`)
            .then(response => {
                if (response.data.success) {
                    message.success('Account deleted successfully');
                    axios.get(`${USER_SERVER}/logout`).then(() => {
                        props.history.push("/login");
                    });
                } else {
                    message.error('Failed to delete account');
                }
            })
            .catch(err => message.error('Failed to delete account'));
        setIsModalVisible(false);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
    };

    return (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="app" style={{ height: 'auto', paddingBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <FaCode style={{ fontSize: '4rem' }} /><br />
                <span style={{ fontSize: '2rem' }}>ChatApp</span>
            </div>

            {user.userData && user.userData.isAuth ? (
                <Card title="Manage Account" style={{ width: 400 }}>
                    <form onSubmit={onUpdate}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>First Name</label>
                            <Input 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Last Name</label>
                            <Input 
                                value={lastname}
                                onChange={(e) => setLastname(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="primary" htmlType="submit" block>
                            Update Username
                        </Button>
                    </form>
                    <div style={{ marginTop: '2rem', borderTop: '1px solid #f0f0f0', paddingTop: '1rem' }}>
                        <Title level={4} style={{ color: 'red' }}>Danger Zone</Title>
                        <Button type="danger" block onClick={showDeleteConfirm}>
                            Delete Account
                        </Button>
                    </div>
                </Card>
            ) : (
                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>Welcome to ChatApp! Please log in or register to start chatting.</p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <Button type="primary" size="large" onClick={() => props.history.push('/login')}>
                            Log In
                        </Button>
                        <Button size="large" onClick={() => props.history.push('/register')}>
                            Register
                        </Button>
                    </div>
                </div>
            )}

            <div style={{ marginTop: '2rem' }}>MERN chat app with socket.io</div>

            <Modal title="Delete Account" visible={isModalVisible} onOk={handleDelete} onCancel={handleCancel} okText="Yes, Delete" okType="danger" cancelText="Cancel">
                <p>Are you sure you want to delete your account? This action cannot be undone.</p>
                <p>Your previous messages will still be visible to others as "Unknown User".</p>
            </Modal>
        </div>
    )
}

export default withRouter(LandingPage);
