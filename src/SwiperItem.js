import React from 'react';
import {View, Animated} from 'react-native';
import Animation from './Animation';
import Item from './Item';
import {isPropsChanged} from './Util';

export default class SwiperItem extends React.Component {
  size = {
    width: 0,
    height: 0,
  };

  constructor(props) {
    super(props);
    this.state = {
      animationStyle: {
        container: null,
        body: null,
        innerBody: null,
      },
    };
  }

  componentDidMount() {
    this.init(this.props);
  }

  shouldComponentUpdate(nextProps, nextState, nextContext) {
    if (nextProps !== this.props) {
      this.init(nextProps, this.props);
    }
    return true;
  }

  init(props, prevProps) {
    if (
      prevProps != null &&
      isPropsChanged(props, prevProps, ['updateKey', 'item', 'itemScaleAlign', 'activeItemScale', 'inactiveItemScale'])
    ) {
      this.resetAnimationTranslateYInterpolate(props);
    }
  }

  resetAnimationTranslateYInterpolate(props) {
    if (this.size) {
      const {height} = this.size;
      const {item, itemScaleAlign, activeItemScale, inactiveItemScale} = props;
      if (itemScaleAlign !== 'middle') {
        let activeTranslateY = (height - height * activeItemScale) / activeItemScale;
        let inactiveTranslateY = (height - height * inactiveItemScale) / 2 / inactiveItemScale;
        if (itemScaleAlign === 'top') {
          activeTranslateY = -activeTranslateY;
          inactiveTranslateY = -inactiveTranslateY;
        }
        item.animation.setOutputRanges(Animation.Key.TranslateY, [
          inactiveTranslateY,
          inactiveTranslateY,
          activeTranslateY,
          inactiveTranslateY,
          inactiveTranslateY,
        ]);
        item.makeAnimationInterpolate(Animation.Key.TranslateY);
      }
      const {zIndex, opacity, translateXContainer, scale, translateX, translateY, innerScale} =
        item.animationInterpolates;
      // container style
      const containerStyle = {transform: []};
      if (zIndex) {
        containerStyle.zIndex = zIndex;
      }
      if (opacity) {
        containerStyle.opacity = opacity;
      }
      if (translateXContainer) {
        containerStyle.transform.push({translateX: translateXContainer});
      }
      // body style
      const bodyStyle = {transform: []};
      if (scale) {
        bodyStyle.transform.push({scale});
      }
      if (translateX) {
        bodyStyle.transform.push({translateX});
      }
      if (itemScaleAlign !== 'middle' && translateY) {
        bodyStyle.transform.push({translateY});
      }
      // inner body transform style
      const innerBodyStyle = {transform: []};
      if (innerScale) {
        innerBodyStyle.transform.push({scale: innerScale});
      }
      this.setState({
        animationStyle: {
          container: containerStyle,
          body: bodyStyle,
          innerBody: innerBodyStyle,
        },
      });
    }
  }

  render() {
    const {children, width, realItemWidth, itemAlign} = this.props;
    const {animationStyle} = this.state;
    let justifyContent;
    switch (itemAlign) {
      case Item.Align.Top:
        justifyContent = 'flex-start';
        break;
      case Item.Align.Bottom:
        justifyContent = 'flex-end';
        break;
      default:
        justifyContent = 'center';
        break;
    }

    return (
      <Animated.View style={[{flex: 1, justifyContent, width}, animationStyle.container]}>
        <Animated.View style={[{alignItems: 'center', width}, animationStyle.body]}>
          <Animated.View style={[{width: realItemWidth || width}, animationStyle.innerBody]}>
            <View
              onLayout={e => {
                this.size = {width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height};
                this.resetAnimationTranslateYInterpolate(this.props);
              }}>
              {children}
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    );
  }
}
