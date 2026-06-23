import React from "react";
import moment from 'moment';
import { Comment, Tooltip, Avatar, Popconfirm, Icon, Dropdown, Menu } from 'antd';

function ChatCard(props) {
    const { onDelete, currentUserId, isAdmin } = props;
    const canDelete = isAdmin || (props.sender && props.sender._id === currentUserId);

    const senderName = props.sender ? props.sender.name : "Unknown User";
    const senderImage = props.sender ? props.sender.image : "";
    const messageText = props.message || "";

    const actionsMenu = (
        <Menu>
            <Menu.Item key="edit" onClick={() => props.onEdit && props.onEdit(props._id, messageText)}>
                Edit
            </Menu.Item>
            <Menu.Item key="delete">
                <Popconfirm title="Delete this message?" onConfirm={() => onDelete(props._id)} okText="Yes" cancelText="No">
                    <Icon type="delete" style={{ color: '#f5222d' }} />
                </Popconfirm>
            </Menu.Item>
        </Menu>
    );

    const actionDropdown = (
        <Dropdown overlay={actionsMenu} trigger={['click']} placement="bottomRight">
            <Icon type="ellipsis" style={{ fontSize: '16px', cursor: 'pointer', marginLeft: 8 }} />
        </Dropdown>
    );

    // Build the message body (text, image, or video)
    const messageBody = messageText.substring(0, 8) === "uploads/" ? (
        messageText.substring(messageText.length - 3) === 'mp4' ? (
            <video
                style={{ maxWidth: '200px' }}
                src={`http://localhost:5000/${messageText}`}
                alt="video"
                type="video/mp4"
                controls
            />
        ) : (
            <img
                style={{ maxWidth: '200px' }}
                src={`http://localhost:5000/${messageText}`}
                alt="img"
            />
        )
    ) : (
        <p>{messageText}</p>
    );

    // Determine if this message is from the current user
    const isOwnMessage = props.sender && props.sender._id === currentUserId;

    return (
        <div style={{ display: 'flex', flexDirection: isOwnMessage ? 'row-reverse' : 'row', justifyContent: 'flex-start', alignItems: 'flex-start', width: '100%' }}>
            <Comment
                author={senderName}
                avatar={
                    <Avatar
                        src={senderImage}
                        alt={senderName}
                    />
                }
                content={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ flexGrow: 1 }}>{messageBody}</div>
                        {canDelete ? actionDropdown : null}
                    </div>
                }
                datetime={
                    <Tooltip title={moment(props.createdAt).format('YYYY-MM-DD HH:mm:ss')}>
                        <span>{moment(props.createdAt).format('HH:mm:ss')}</span>
                    </Tooltip>
                }
                style={{
                    backgroundColor: isOwnMessage ? '#e6f7ff' : '#fff',
                    borderRadius: '8px',
                    padding: '8px',
                    maxWidth: '70%'
                }}
            />
        </div>
    );
}

export default ChatCard;