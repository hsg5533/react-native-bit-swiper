import React from 'react';
import {View} from 'react-native';
import SwiperPaginateDot from './SwiperPaginateDot';

export default class SwiperPaginate extends React.Component {
  static defaultProps = {
    activeIndex: 0,
  };

  state = {
    activeIndex: null,
  };

  componentDidMount() {
    this.init(this.props);
  }

  shouldComponentUpdate(nextProps) {
    this.init(nextProps, this.props);
    return true;
  }

  init(props, prevProps) {
    if (prevProps == null || props.activeIndex !== prevProps.activeIndex) {
      this.setState({activeIndex: props.activeIndex});
    }
  }

  setActiveIndex(activeIndex) {
    const {activeIndex: stateActiveIndex} = this.state;
    if (stateActiveIndex !== activeIndex) {
      this.setState({activeIndex});
    }
  }

  render() {
    const {style, dotStyle, activeDotStyle, total, onDotRender} = this.props;
    const {activeIndex} = this.state;
    return (
      <View style={[{margin: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}, style]}>
        {new Array(total).fill(0).map((_, index) => (
          <SwiperPaginateDot
            key={index}
            index={index}
            active={activeIndex === index}
            style={dotStyle}
            activeStyle={activeDotStyle}
            onRender={onDotRender}
          />
        ))}
      </View>
    );
  }
}
