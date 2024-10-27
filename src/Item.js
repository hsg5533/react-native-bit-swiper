const Type = {
  LeftClone: 'leftClone',
  Base: 'base',
  RightClone: 'rightClone',
};

const Align = {
  Top: 'top',
  Middle: 'middle',
  Bottom: 'bottom',
  $all: ['top', 'middle', 'bottom'],
};

const ScaleAlign = {
  Top: 'top',
  Middle: 'middle',
  Bottom: 'bottom',
  $all: ['top', 'middle', 'bottom'],
};

export default class Item {
  static Type = Type;
  static Align = Align;
  static ScaleAlign = ScaleAlign;

  constructor(type, data, baseCount, baseIndex, animation) {
    this.$updateKey = 0;
    this.$type = type;
    this.$data = data;
    this.$baseCount = baseCount;
    this.$baseIndex = baseIndex;
    this.$animation = animation;
    this.$distanceFromBase = 0;
    this.$index = null;
    this.$x = null;
    this.$animationInputRanges = null;
    this.$animationInterpolates = {};
  }

  clone(type) {
    const item = new Item(type || this.$type, this.$data, this.$baseCount, this.$baseIndex, this.$animation);
    item.$distanceFromBase = this.$distanceFromBase;
    item.$index = this.$index;
    item.$x = this.$x;
    item.$animationInputRanges = this.$animationInputRanges ? [...this.$animationInputRanges] : null;
    item.$animationInterpolates = {...this.$animationInterpolates};
    return item;
  }

  makeAnimationInterpolates() {
    const interpolates = this.$animation.makeInterpolates(this);
    this.updateAnimationInterpolates(
      Object.keys(interpolates).map(key => ({
        key,
        value: interpolates[key],
      })),
    );
  }

  makeAnimationInterpolate(keys) {
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        this.updateAnimationInterpolates({
          key,
          value: this.$animation.makeInterpolate(this, key),
        });
      });
    } else {
      this.updateAnimationInterpolates({
        key: keys,
        value: this.$animation.makeInterpolate(this, keys),
      });
    }
  }

  updateAnimationInterpolates(animationInterpolates) {
    this.$updateKey += 1;
    if (Array.isArray(animationInterpolates)) {
      animationInterpolates.forEach(({key, value}) => {
        this.animationInterpolates[key] = value;
      });
    } else {
      this.animationInterpolates[animationInterpolates.key] = animationInterpolates.value;
    }
  }

  get updateKey() {
    return this.$updateKey;
  }

  get baseCount() {
    return this.$baseCount;
  }

  get baseIndex() {
    return this.$baseIndex;
  }

  get animation() {
    return this.$animation;
  }

  get distanceFromBase() {
    return this.$distanceFromBase;
  }
  set distanceFromBase(distanceFromBase) {
    this.$distanceFromBase = distanceFromBase;
  }

  get index() {
    return this.$index;
  }
  set index(index) {
    this.$index = index;
  }

  get x() {
    return this.$x;
  }
  set x(x) {
    this.$x = x;
  }

  get animationInputRanges() {
    return this.$animationInputRanges;
  }
  set animationInputRanges(animationInputRanges) {
    this.$animationInputRanges = animationInputRanges;
  }

  get animationInterpolates() {
    return this.$animationInterpolates;
  }
}
