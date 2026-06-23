import React from 'react';
import { Menu } from 'antd';
import { useSelector } from "react-redux";

function LeftMenu(props) {
  const user = useSelector(state => state.user);

  return (
    <Menu mode={props.mode}>
      <Menu.Item key="mail">
        <a href="/">Home</a>
      </Menu.Item>
      {user.userData && user.userData.isAuth && (
        <Menu.Item key="chat">
          <a href="/chat">Chat</a>
        </Menu.Item>
      )}
    </Menu>
  )
}

export default LeftMenu;