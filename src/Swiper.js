import React from 'react';
import {Platform, View, Animated} from 'react-native';
import Item from './Item';
import Animation from './Animation';
import SwiperItem from './SwiperItem';
import SwiperPaginate from './SwiperPaginate';
import {isIndexIn, isPropsChanged, nextTick} from './Util';

const isIos = Platform.OS === 'ios';
const toFixedFractionDigits = 5;

export default class Swiper extends React.Component {
  static defaultProps = {
    initItemIndex: 0,
    itemWidth: '100%',
    itemAlign: Item.Align.Top,
    itemScaleAlign: Item.ScaleAlign.Middle,
    activeItemScale: 1,
    activeItemOpacity: 1,
    inactiveItemScale: 1,
    inactiveItemOpacity: 1,
    inactiveItemOffset: 0,
    loop: false,
    loopSingleItem: false,
    loopCloneCount: 4,
    autoplay: false,
    autoplayDelay: 1000,
    autoplayInterval: 3000,
    showPaginate: true,
  };

  state = {
    items: null, // Loop 시 복사 아이템을 포함한 전체 아이템
    baseItemIndex: 0, // items 에서 원본 아이템의 시작 위치
    baseItemCount: 0, // 원본 아이템 수
    contentOffset: {}, // ScrollView 에서 이동할 스크롤 위치 - iOS 에서 사용
    animationInputRangeType: null,
    realLoopCloneCount: 0, // 실제 LoopCloneCount
    scrollToIndexWhenScrollContentSizeChange: null, // 컨텐츠 사이즈 변경 시 이동할 index (안드로이드에서만 사용)
  };

  animation = new Animation();
  paginateRef = React.createRef(); // 페이지 UI 의 ref
  scrollViewRef; // ScrollView 의 ref
  width; // 컨테이너의 넓이
  realItemWidth; // 실제 아이템 넓이 - Props 의 itemWidth 값에서 계산된 실제 넓이
  scrollContentSize = 0; // ScrollView 의 컨텐츠 크기
  scrollToBaseTimer; // Loop 일 때, 복사 아이템으로 이동하면, 원본 아이템으로 이동하는 Timer
  lastScrollPos = 0; // ScrollView 의 마지막 스크롤 위치
  isLastExactScrollPos = true; // 마지막 스크롤이 정확한 위치인지 여부 (updateUI 에서 사용)
  autoplayTimer; // 자동 스크롤 Timer
  autoplayDelayed = false; // 자동 스크롤 delay 사용 여부
  lastActiveChangeBaseItemIndex = 0; // 활성화 된 원본 아이템 Index
  lastActiveChangingBaseItemIndex = 0; // 스크롤 중 활성화 된 원본 아이템 Index
  isScrolling = false; // 스크롤 중인지 여부
  scrollToIndexWhenEndScrolling = null; // 스크롤 완료 시 이동할 index
  lastAnimatedScrollToIndex = null; // 마지막 scrollTo 호출 index (animated=true 인 경우)
  skipItemIndexChangeEventToIndex = null; // activeItem() 호출 시 애니메이션 중 지나치는 아이템의 index 변경 이벤트 발생시키지 않음

  componentDidMount() {
    this.init(this.props, null, this.state);
  }

  componentWillUnmount() {
    this.stopAutoplayTimer();
    this.stopScrollToBaseTimer();
  }

  shouldComponentUpdate(nextProps, nextState, nextContext) {
    if (this.props !== nextProps) {
      return this.init(nextProps, this.props, nextState);
    } else {
      return true;
    }
  }

  init(props, prevProps, state) {
    let makeItems = false;
    const animationInputRangeType = this.getAnimationInputRangeType(props);
    if (state.animationInputRangeType !== animationInputRangeType) {
      makeItems = true;
    }
    if (prevProps != null && isPropsChanged(props, prevProps, ['autoplayDelay'])) {
      this.autoplayDelayed = false;
    }
    if (prevProps != null && isPropsChanged(props, prevProps, ['loopCloneCount'])) {
      if (this.canLoop(props.loop, props.loopSingleItem, props.items.length)) {
        const realLoopCloneCount = this.getRealLoopCloneCount(
          props.loopCloneCount,
          animationInputRangeType,
          props.items.length,
        );
        if (state.realLoopCloneCount !== realLoopCloneCount) {
          makeItems = true;
        }
      }
    }
    if (
      !makeItems &&
      (prevProps == null || isPropsChanged(props, prevProps, ['items', 'itemWidth', 'loop', 'loopSingleItem']))
    ) {
      makeItems = true;
    }
    if (
      prevProps == null ||
      isPropsChanged(props, prevProps, ['itemWidth', 'inactiveItemScale', 'inactiveItemOffset'])
    ) {
      if (this.width != null) {
        this.resetItemWidthAndTranslateX(props, state, !makeItems);
      }
    }
    if (prevProps == null || isPropsChanged(props, prevProps, ['activeItemOpacity', 'inactiveItemOpacity'])) {
      if (props.activeItemOpacity === 1 && props.inactiveItemOpacity === 1) {
        this.animation.setOutputRanges(Animation.Key.Opacity, null);
      } else {
        this.animation.setOutputRanges(Animation.Key.Opacity, [
          props.inactiveItemOpacity,
          props.inactiveItemOpacity,
          props.activeItemOpacity,
          props.inactiveItemOpacity,
          props.inactiveItemOpacity,
        ]);
      }
      if (!makeItems && state.items) {
        state.items.forEach(item => {
          item.makeAnimationInterpolate(Animation.Key.Opacity);
        });
      }
    }
    if (prevProps == null || isPropsChanged(props, prevProps, ['activeItemScale', 'inactiveItemScale'])) {
      const {activeItemScale, inactiveItemScale} = props;
      if (activeItemScale === 1 && inactiveItemScale === 1) {
        this.animation.setOutputRanges(Animation.Key.Scale, null);
        this.animation.setOutputRanges(Animation.Key.InnerScale, null);
      } else {
        this.animation.setOutputRanges(Animation.Key.Scale, [
          activeItemScale * inactiveItemScale,
          inactiveItemScale,
          activeItemScale * inactiveItemScale,
          inactiveItemScale,
          activeItemScale * inactiveItemScale,
        ]);
        this.animation.setOutputRanges(Animation.Key.InnerScale, [
          activeItemScale / inactiveItemScale,
          1,
          activeItemScale / inactiveItemScale,
          1,
          activeItemScale / inactiveItemScale,
        ]);
      }
      if (!makeItems && state.items) {
        state.items.forEach(item => {
          item.makeAnimationInterpolate([Animation.Key.Scale, Animation.Key.InnerScale]);
        });
      }
    }
    if (prevProps == null || isPropsChanged(props, prevProps, ['autoplay', 'autoplayDelay', 'autoplayInterval'])) {
      if (props.autoplay) {
        nextTick(() => {
          this.startAutoplayTimer();
        });
      } else {
        this.stopAutoplayTimer();
      }
    }
    if (makeItems) {
      this.makeItems(props);
      return false;
    } else {
      return true;
    }
  }

  makeItems(props) {
    if (this.width == null) {
      return;
    }
    const {
      initItemIndex: propsInitItemIndex,
      items: propsItems,
      loop,
      loopCloneCount,
      loopSingleItem,
      showPaginate,
    } = props;
    const {items: stateItems} = this.state;
    this.stopScrollToBaseTimer();
    if (propsItems == null || propsItems.length === 0) {
      this.stopScrollToBaseTimer();
      this.stopAutoplayTimer();
      this.scrollViewRef = null;
      this.scrollContentSize = 0;
      this.lastScrollPos = 0;
      this.lastActiveChangeBaseItemIndex = 0;
      this.lastActiveChangingBaseItemIndex = 0;
      this.setState({
        items: null,
        baseItemIndex: 0,
        baseItemCount: 0,
        contentOffset: {},
      });
    } else {
      const animationInputRangeType = this.getAnimationInputRangeType(props);
      // 원본 아이템
      const baseItems = propsItems.map(
        (data, index) => new Item(Item.Type.Base, data, propsItems.length, index, this.animation),
      );
      const baseItemCount = baseItems.length;
      // 시작 아이템 Index
      let initItemIndex = 0;
      if (stateItems != null && stateItems.length > 0) {
        const lastScrollPos = this.lastScrollPos || 0;
        const lastItemIndex = this.getItemIndex(lastScrollPos, true);
        if (isIndexIn(lastItemIndex, stateItems.length)) {
          initItemIndex = stateItems[lastItemIndex].baseIndex;
        }
      } else {
        initItemIndex = propsInitItemIndex;
      }
      if (initItemIndex < 0) {
        initItemIndex = 0;
      } else if (initItemIndex >= baseItemCount) {
        initItemIndex = baseItemCount - 1;
      }
      // 아이템
      const items = [...baseItems];
      let baseItemIndex = 0;
      // Loop 시 아이템 추가
      let realLoopCloneCount = 0;
      if (this.canLoop(loop, loopSingleItem, baseItems.length)) {
        realLoopCloneCount = this.getRealLoopCloneCount(loopCloneCount, animationInputRangeType, items.length);
        const maxIndex = baseItemCount - 1;
        let distanceFromBase = 0;
        for (let i = 0; i < realLoopCloneCount; i += 1) {
          let leftCloneIndex = maxIndex - (i % baseItemCount);
          const rightCloneIndex = Math.abs(i % baseItemCount);
          distanceFromBase += 1;
          const leftCloneItem = baseItems[leftCloneIndex].clone(Item.Type.LeftClone);
          leftCloneItem.distanceFromBase = -distanceFromBase;
          items.unshift(leftCloneItem);
          const rightCloneItem = baseItems[rightCloneIndex].clone(Item.Type.RightClone);
          rightCloneItem.distanceFromBase = distanceFromBase;
          items.push(rightCloneItem);
        }
        baseItemIndex = realLoopCloneCount;
      }
      // 기본 정보 설정
      items.forEach((item, index) => {
        item.index = index;
        item.x = index * this.width;
      });
      // 애니메이션 정보 설정
      let animationInputRanges = null;
      if (animationInputRangeType === Animation.InputRangeType.Items) {
        animationInputRanges = {
          type: Animation.InputRangeType.Items,
          ...items.reduce(
            (v, item, index) => {
              v.items.push(item);
              v.values.push(index * this.width);
              return v;
            },
            {
              items: [],
              values: [],
            },
          ),
        };
      }
      // 아이템 정보 설정
      items.forEach(item => {
        if (animationInputRangeType === Animation.InputRangeType.Item) {
          animationInputRanges = {
            type: Animation.InputRangeType.Item,
            values: [
              item.x - this.width * 2,
              item.x - this.width,
              item.x,
              item.x + this.width,
              item.x + this.width * 2,
            ],
          };
        }
        item.animationInputRanges = animationInputRanges;
        item.makeAnimationInterpolates();
      });
      // 시작 위치
      const initScrollIndex = baseItemIndex + initItemIndex;
      const initScrollPos = initScrollIndex * this.width;
      const contentOffset = this.makeContentOffset(initScrollPos);
      let scrollToIndexWhenScrollContentSizeChange = null;
      if (!isIos) {
        if (stateItems && stateItems.length !== items.length) {
          scrollToIndexWhenScrollContentSizeChange = initScrollIndex;
        } else {
          if (this.lastScrollPos !== initScrollPos) {
            if (initScrollPos > this.scrollContentSize) {
              scrollToIndexWhenScrollContentSizeChange = initScrollIndex;
            }
          }
        }
      }
      this.setState(
        {
          items,
          baseItemIndex,
          baseItemCount,
          contentOffset,
          animationInputRangeType,
          realLoopCloneCount,
          scrollToIndexWhenScrollContentSizeChange,
        },
        () => {
          if (this.lastScrollPos === initScrollPos) {
            this.updateUI();
          } else {
            if (this.isScrolling) {
              this.scrollToIndexWhenEndScrolling = {
                index: initScrollIndex,
                animated: false,
              };
            } else {
              if (isIos) {
                this.animation.value.setValue(initScrollPos);
              } else {
                if (scrollToIndexWhenScrollContentSizeChange != null) {
                  this.scrollTo(initScrollIndex, false);
                }
              }
            }

            if (showPaginate && this.paginateRef.current) {
              this.paginateRef.current.setActiveIndex(initItemIndex);
            }
          }
        },
      );
    }
  }

  updateUI() {
    const {autoplay, showPaginate, onItemIndexChanging, onItemIndexChange} = this.props;
    const {items, baseItemCount, animationInputRangeType, realLoopCloneCount} = this.state;
    if (items == null) {
      return;
    }
    const itemIndex = this.getItemIndex(this.lastScrollPos);
    const isExactItemIndex = Number.isInteger(itemIndex);
    if (isExactItemIndex) {
      this.isScrolling = false;
      this.lastAnimatedScrollToIndex = null;
      if (this.scrollToIndexWhenEndScrolling != null) {
        this.scrollTo(this.scrollToIndexWhenEndScrolling.index, this.scrollToIndexWhenEndScrolling.animated);
        this.scrollToIndexWhenEndScrolling = null;
      }
      if (isIndexIn(itemIndex, items.length)) {
        if (this.skipItemIndexChangeEventToIndex != null && this.skipItemIndexChangeEventToIndex === itemIndex) {
          this.skipItemIndexChangeEventToIndex = null;
        }
        const baseItemIndex = items[itemIndex].baseIndex;
        if (baseItemIndex !== this.lastActiveChangeBaseItemIndex) {
          if (this.skipItemIndexChangeEventToIndex == null && onItemIndexChange) {
            onItemIndexChange(baseItemIndex);
          }
          this.lastActiveChangeBaseItemIndex = baseItemIndex;
        } else {
          if (!this.isLastExactScrollPos || this.lastActiveChangingBaseItemIndex !== baseItemIndex) {
            if (this.skipItemIndexChangeEventToIndex == null && onItemIndexChanging) {
              onItemIndexChanging(baseItemIndex);
            }
            this.lastActiveChangingBaseItemIndex = baseItemIndex;
          }
        }
        if (showPaginate && this.paginateRef.current) {
          this.paginateRef.current.setActiveIndex(baseItemIndex);
        }
      }
      this.isLastExactScrollPos = true;
    } else {
      if (!this.isScrolling) {
        this.beginScrolling();
      }
      const nearItemIndex = Math.round(itemIndex);
      if (isIndexIn(nearItemIndex, items.length)) {
        const baseItemIndex = items[nearItemIndex].baseIndex;
        if (baseItemIndex !== this.lastActiveChangingBaseItemIndex) {
          if (showPaginate && this.paginateRef.current) {
            this.paginateRef.current.setActiveIndex(baseItemIndex);
          }
          if (this.skipItemIndexChangeEventToIndex != null && this.skipItemIndexChangeEventToIndex === nearItemIndex) {
            this.skipItemIndexChangeEventToIndex = null;
          }
          if (this.skipItemIndexChangeEventToIndex == null && onItemIndexChanging) {
            onItemIndexChanging(baseItemIndex);
          }
          this.lastActiveChangingBaseItemIndex = baseItemIndex;
        }
      }
      this.isLastExactScrollPos = false;
    }
    // Loop 일 때, 복사 아이템으로 이동하면, 원본 아이템으로 이동하는 Timer 시작
    if (isExactItemIndex) {
      this.stopScrollToBaseTimer();
      if (!this.isScrolling) {
        const {loop, loopSingleItem} = this.props;
        if (this.scrollViewRef && this.canLoop(loop, loopSingleItem, baseItemCount)) {
          this.scrollToBaseTimer = setTimeout(
            () => {
              this.scrollToBaseTimer = null;
              if (Number.isInteger(itemIndex) && isIndexIn(itemIndex, items.length)) {
                const item = items[itemIndex];
                if (itemIndex !== realLoopCloneCount + item.baseIndex) {
                  let toActiveItemIndex;
                  if (animationInputRangeType === Animation.InputRangeType.Item || baseItemCount > 2) {
                    toActiveItemIndex = realLoopCloneCount + items[itemIndex].baseIndex;
                  } else {
                    if (Math.abs(item.distanceFromBase) > 2) {
                      if (item.distanceFromBase > 0) {
                        toActiveItemIndex = item.index - 4;
                      } else {
                        toActiveItemIndex = item.index + 4;
                      }
                    }
                  }
                  if (toActiveItemIndex != null) {
                    const toActiveItem = items[toActiveItemIndex];
                    if (isIos) {
                      this.setState({
                        contentOffset: this.makeContentOffset(toActiveItem.x),
                      });
                    } else {
                      this.scrollTo(toActiveItem.index, false);
                    }
                  }
                }
              }
            },
            // Android 는 터치 해제 시 100 Millisecond 안에 onScroll 다시 이벤트하는 경우가 있음
            isIos ? 10 : 100,
          );
        }
      }
    }
    // 자동 스크롤 Timer 시작
    if (isExactItemIndex && autoplay) {
      this.startAutoplayTimer();
    }
  }

  stopScrollToBaseTimer() {
    if (this.scrollToBaseTimer) {
      clearTimeout(this.scrollToBaseTimer);
      this.scrollToBaseTimer = null;
    }
  }

  startAutoplayTimer() {
    this.stopAutoplayTimer();
    const {autoplayDelay, autoplayInterval} = this.props;
    this.autoplayTimer = setTimeout(
      () => {
        this.autoplayTimer = null;
        this.autoplayDelayed = true;

        const itemIndex = this.getItemIndex(this.lastScrollPos);

        if (Number.isInteger(itemIndex)) {
          const {items} = this.state;
          if (items) {
            const toIndex = (itemIndex + 1) % items.length;
            this.scrollTo(toIndex);
          }
        }
      },
      this.autoplayDelayed ? autoplayInterval : autoplayDelay + autoplayInterval,
    );
  }

  stopAutoplayTimer() {
    if (this.autoplayTimer) {
      clearTimeout(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  beginScrolling() {
    this.isScrolling = true;
    this.stopAutoplayTimer();
    this.stopScrollToBaseTimer();
  }

  getAnimationInputRangeType(props) {
    const {
      items,
      loop,
      loopSingleItem,
      activeItemScale,
      activeItemOpacity,
      inactiveItemScale,
      inactiveItemOpacity,
      inactiveItemOffset,
    } = props;
    return isIos ||
      (items.length === 1 && !this.canLoop(loop, loopSingleItem, items.length)) ||
      (activeItemScale === 1 &&
        activeItemOpacity === 1 &&
        inactiveItemScale === 1 &&
        inactiveItemOpacity === 1 &&
        inactiveItemOffset === 0)
      ? Animation.InputRangeType.Item
      : Animation.InputRangeType.Items;
  }

  getRealLoopCloneCount(loopCloneCount, animationInputRangeType, itemsCount) {
    let minLoopCloneCount = 1;
    let realLoopCloneCount;
    if (animationInputRangeType === Animation.InputRangeType.Item) {
      realLoopCloneCount = Math.max(minLoopCloneCount, loopCloneCount);
    } else {
      if (itemsCount < 3) {
        realLoopCloneCount = 6;
      } else {
        realLoopCloneCount = Math.max(minLoopCloneCount, loopCloneCount);
      }
    }
    return realLoopCloneCount;
  }

  getItemIndex(scrollPos, round = false) {
    const itemIndex = Number((scrollPos / this.width).toFixed(toFixedFractionDigits));
    if (round) {
      return Math.round(itemIndex);
    } else {
      return itemIndex;
    }
  }

  resetItemWidthAndTranslateX(props, state, updateItems = true) {
    if (this.width != null) {
      const {itemWidth, inactiveItemScale, inactiveItemOffset} = props;
      this.realItemWidth = itemWidth || this.width;
      if (typeof itemWidth === 'string') {
        if (itemWidth.includes('%')) {
          this.realItemWidth = this.width * (Number(itemWidth.replace(/%/g, '')) / 100);
        } else {
          this.realItemWidth = Number(itemWidth);
        }
      }
      if (inactiveItemScale === 1 && inactiveItemOffset === 0) {
        this.animation.setOutputRanges(Animation.Key.TranslateX, null);
        this.animation.setOutputRanges(Animation.Key.TranslateXContainer, null);
      } else {
        const inactiveItemWidth = this.realItemWidth * inactiveItemScale;
        const translateX = (this.width - inactiveItemWidth) / 2 / inactiveItemScale;
        this.animation.setOutputRanges(Animation.Key.TranslateX, [
          -translateX * 2,
          -translateX,
          0,
          translateX,
          translateX * 2,
        ]);
        this.animation.setOutputRanges(Animation.Key.TranslateXContainer, [
          -inactiveItemOffset * 2,
          -inactiveItemOffset,
          0,
          inactiveItemOffset,
          inactiveItemOffset * 2,
        ]);
      }
      if (updateItems && state.items) {
        state.items.forEach(item => {
          item.makeAnimationInterpolate([Animation.Key.TranslateX, Animation.Key.TranslateXContainer]);
        });
      }
    }
  }

  makeContentOffset(x) {
    const {contentOffset} = this.state;
    if (contentOffset.x === x) {
      // 기존 값과 같으면 UI가 onScroll 이벤트가 발생하지 않기 때문에 처리
      return {x: x + 0.00000000001, y: 0};
    } else {
      return {x, y: 0};
    }
  }

  canLoop(loop, loopSingleItem, baseItemsCount) {
    return loop && baseItemsCount > 0 && (loopSingleItem || baseItemsCount > 1);
  }

  scrollTo(index, animated = true) {
    if (this.scrollViewRef) {
      const x = index * this.width;
      if (x <= this.scrollContentSize) {
        if (this.lastScrollPos !== x) {
          this.lastAnimatedScrollToIndex = index;
          if (!isIos && this.isScrolling) {
            this.scrollToIndexWhenEndScrolling = {
              index,
              animated,
            };
          } else {
            if (animated) {
              this.beginScrolling();
            } else {
              this.stopAutoplayTimer();
              this.stopScrollToBaseTimer();
            }
            this.scrollViewRef.scrollTo({x, y: 0, animated});
          }
        }
      }
    }
  }

  handleTouchEnd = () => {
    if (Number.isInteger(this.getItemIndex(this.lastScrollPos))) {
      this.updateUI();
    }
  };

  render() {
    const {
      style,
      items: propsItems,
      onItemRender,
      activeItemScale,
      inactiveItemScale,
      itemAlign,
      itemScaleAlign,
      showPaginate,
      paginateStyle,
      paginateDotStyle,
      paginateActiveDotStyle,
      onPaginateDotRender,
    } = this.props;
    const {items, baseItemCount, contentOffset, scrollToIndexWhenScrollContentSizeChange} = this.state;
    const renderItems = propsItems.map((item, index) => onItemRender && onItemRender(item, index));
    return (
      <View
        style={[{width: '100%'}, style]}
        onLayout={e => {
          const width = e.nativeEvent.layout.width;
          if (width !== this.width) {
            this.width = width;
            this.animation.setOutputRanges(Animation.Key.ZIndex, [1, 1, width, 1, 1]);
            this.resetItemWidthAndTranslateX(this.props, this.state, false);
            this.makeItems(this.props);
          }
          const {onLayout} = this.props;
          if (onLayout) {
            onLayout(e);
          }
        }}>
        {items && (
          <React.Fragment>
            <Animated.ScrollView
              ref={ref => (this.scrollViewRef = ref)}
              style={{opacity: scrollToIndexWhenScrollContentSizeChange == null ? 1 : 0}}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={8}
              decelerationRate="fast"
              pagingEnabled
              contentOffset={contentOffset}
              onScroll={Animated.event([{nativeEvent: {contentOffset: {x: this.animation.value}}}], {
                useNativeDriver: true,
                listener: e => {
                  const x = e.nativeEvent.contentOffset.x;
                  if (this.lastScrollPos !== x) {
                    this.lastScrollPos = x;
                    this.updateUI();
                  }
                },
              })}
              onTouchStart={() => (this.skipItemIndexChangeEventToIndex = null)}
              onTouchEnd={this.handleTouchEnd}
              onScrollBeginDrag={() => this.beginScrolling()}
              onScrollEndDrag={() => this.handleTouchEnd()}
              onContentSizeChange={contentSize => {
                this.scrollContentSize = contentSize;
                if (scrollToIndexWhenScrollContentSizeChange != null) {
                  if (scrollToIndexWhenScrollContentSizeChange * this.width <= this.scrollContentSize) {
                    this.scrollTo(scrollToIndexWhenScrollContentSizeChange, false);
                    this.setState({
                      scrollToIndexWhenScrollContentSizeChange: null,
                    });
                  }
                }
              }}>
              {items.map((item, index) => (
                <SwiperItem
                  key={index}
                  updateKey={item.updateKey}
                  width={this.width}
                  realItemWidth={this.realItemWidth}
                  item={item}
                  itemAlign={itemAlign}
                  activeItemScale={activeItemScale}
                  inactiveItemScale={inactiveItemScale}
                  itemScaleAlign={itemScaleAlign}>
                  {renderItems[item.baseIndex]}
                </SwiperItem>
              ))}
            </Animated.ScrollView>
            {showPaginate && (
              <SwiperPaginate
                ref={this.paginateRef}
                style={paginateStyle}
                total={baseItemCount}
                dotStyle={paginateDotStyle}
                activeDotStyle={paginateActiveDotStyle}
                onDotRender={onPaginateDotRender}
              />
            )}
          </React.Fragment>
        )}
      </View>
    );
  }
}
