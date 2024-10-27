import React from 'react';
import {View} from 'react-native';

export default class SwiperPaginateDot extends React.Component {
  render() {
    const {index, active, style, activeStyle, onRender} = this.props;
    if (onRender) {
      return onRender(index, active) || null;
    } else {
      let finalStyle;
      if (active) {
        finalStyle = activeStyle
          ? activeStyle
          : {
              backgroundColor: '#0584f2',
              width: 8,
              height: 8,
              borderRadius: 4,
              marginHorizontal: 3,
            };
      } else {
        finalStyle = style
          ? style
          : {
              backgroundColor: 'rgba(0, 0, 0, .2)',
              width: 8,
              height: 8,
              borderRadius: 4,
              marginHorizontal: 3,
            };
      }
      return <View key={index} style={finalStyle} />;
    }
  }
}
