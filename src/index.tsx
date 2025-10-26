import React, {PureComponent} from 'react';
import {
    Animated,
    Easing,
    I18nManager,
    Image,
    ImageSourcePropType,
    LayoutChangeEvent,
    PanResponder,
    PanResponderInstance,
    View,
    ViewStyle,
} from 'react-native';
// styles
import {defaultStyles as styles} from './styles';
import type {Dimensions, SliderProps, SliderState} from './types';

export type {SliderProps} from './types';

type RectReturn = {
    containsPoint: (nativeX: number, nativeY: number) => boolean;
    height: number;
    trackDistanceToPoint: (nativeX: number) => number;
    width: number;
    x: number;
    y: number;
};

const Rect = ({
    height,
    width,
    x,
    y,
}: {
    height: number;
    width: number;
    x: number;
    y: number;
}) => ({
    containsPoint: (nativeX: number, nativeY: number) =>
        nativeX >= x &&
        nativeY >= y &&
        nativeX <= x + width &&
        nativeY <= y + height,
    height,
    trackDistanceToPoint: (nativeX: number) => {
        if (nativeX < x) {
            return x - nativeX;
        }

        if (nativeX > x + width) {
            return nativeX - (x + width);
        }

        return 0;
    },
    width,
    x,
    y,
});

const DEFAULT_ANIMATION_CONFIGS = {
    spring: {
        friction: 7,
        tension: 100,
    },
    timing: {
        duration: 150,
        easing: Easing.inOut(Easing.ease),
        delay: 0,
    },
};

const normalizeValue = (
    props: SliderProps,
    value?: number | Array<number>,
): Array<number> => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
        // For dual slider mode, return two values
        if (props.dualSlider) {
            return [props.minimumValue, props.maximumValue];
        }
        return [0];
    }

    const {maximumValue, minimumValue, dualSlider, allowCrossover} = props;

    const getBetweenValue = (inputValue: number) =>
        Math.max(Math.min(inputValue, maximumValue), minimumValue);

    if (!Array.isArray(value)) {
        return [getBetweenValue(value)];
    }

    const normalizedValues = value.map(getBetweenValue);

    // For dual slider mode, ensure we have exactly 2 values
    if (dualSlider) {
        if (normalizedValues.length === 1) {
            // If only one value provided, create a range
            const singleValue = normalizedValues[0];
            const range = (maximumValue - minimumValue) * 0.1; // 10% of range
            return [
                Math.max(singleValue - range, minimumValue),
                Math.min(singleValue + range, maximumValue),
            ];
        } else if (normalizedValues.length >= 2) {
            // Take first two values
            let [val1, val2] = normalizedValues.slice(0, 2);

            // Handle crossover logic
            if (!allowCrossover && val1 > val2) {
                [val1, val2] = [val2, val1];
            }

            return [val1, val2];
        }
    }

    return normalizedValues.sort((a, b) => a - b);
};

const updateValues = ({
    values,
    newValues = values,
}: {
    values: number | Array<number> | Animated.Value | Array<Animated.Value>;
    newValues?: number | Array<number> | Animated.Value | Array<Animated.Value>;
}): Animated.Value[] => {
    if (
        Array.isArray(newValues) &&
        Array.isArray(values) &&
        newValues.length !== values.length
    ) {
        return updateValues({values: newValues});
    }

    if (Array.isArray(values) && Array.isArray(newValues)) {
        return values?.map((value: number | Animated.Value, index: number) => {
            let valueToSet = newValues[index];
            if (value instanceof Animated.Value) {
                if (valueToSet instanceof Animated.Value) {
                    valueToSet = valueToSet.__getValue();
                }
                value.setValue(valueToSet);
                return value;
            }

            if (valueToSet instanceof Animated.Value) {
                return valueToSet;
            }

            return new Animated.Value(valueToSet);
        });
    }

    return [new Animated.Value(0)];
};

const indexOfLowest = (values: Array<number>): number => {
    let lowestIndex = 0;
    values.forEach((value, index, array) => {
        if (value < array[lowestIndex]) {
            lowestIndex = index;
        }
    });
    return lowestIndex;
};

export class Slider extends PureComponent<SliderProps, SliderState> {
    constructor(props: SliderProps) {
        super(props);
        this._panResponder = PanResponder.create({
            onStartShouldSetPanResponder:
                this._handleStartShouldSetPanResponder,
            onMoveShouldSetPanResponder: this._handleMoveShouldSetPanResponder,
            onPanResponderGrant: this._handlePanResponderGrant,
            onPanResponderMove: this._handlePanResponderMove,
            onPanResponderRelease: this._handlePanResponderEnd,
            onPanResponderTerminationRequest:
                this._handlePanResponderRequestEnd,
            onPanResponderTerminate: this._handlePanResponderEnd,
        });
        this.state = {
            allMeasured: false,
            containerSize: {
                width: 0,
                height: 0,
            },
            thumbSize: {
                width: 0,
                height: 0,
            },
            trackMarksValues: updateValues({
                values: normalizeValue(this.props, this.props.trackMarks),
            }),
            values: updateValues({
                values: normalizeValue(
                    this.props,
                    this.props.value instanceof Animated.Value
                        ? this.props.value.__getValue()
                        : this.props.value,
                ),
            }),
        };
    }

    static defaultProps = {
        animationType: 'timing',
        debugTouchArea: false,
        trackMarks: [],
        maximumTrackTintColor: '#b3b3b3',
        maximumValue: 1,
        minimumTrackTintColor: '#3f3f3f',
        minimumValue: 0,
        step: 0,
        thumbTintColor: '#343434',
        trackClickable: true,
        value: 0,
        vertical: false,
        startFromZero: false,
        dualSlider: false,
        allowCrossover: true,
        rangeTrackTintColor: '#3f3f3f',
    };

    static getDerivedStateFromProps(props: SliderProps, state: SliderState) {
        if (
            props.trackMarks &&
            !!state.trackMarksValues &&
            state.trackMarksValues.length > 0
        ) {
            const newTrackMarkValues = normalizeValue(props, props.trackMarks);
            const statePatch = {} as SliderState;

            if (state.trackMarksValues) {
                statePatch.trackMarksValues = updateValues({
                    values: state.trackMarksValues,
                    newValues: newTrackMarkValues,
                });
            }

            return statePatch;
        }
    }

    componentDidUpdate(prevProps: any) {
        // Check if the value prop has changed
        if (this.props.value !== prevProps.value) {
            // @ts-ignore
            const newValues = normalizeValue(this.props, this.props.value);

            // eslint-disable-next-line react/no-did-update-set-state
            this.setState(
                {
                    values: updateValues({
                        values: this.state.values,
                        newValues: newValues,
                    }),
                },
                () => {
                    newValues.forEach((value, i) => {
                        // @ts-ignore
                        const currentValue = this.state.values[i].__getValue();
                        if (
                            value !== currentValue &&
                            this.props.animateTransitions
                        ) {
                            this._setCurrentValueAnimated(value, i);
                        } else {
                            this._setCurrentValue(value, i);
                        }
                    });
                },
            );
        }

        // Check for other prop changes that might require state updates, e.g., trackMarks
        if (this.props.trackMarks !== prevProps.trackMarks) {
            const newTrackMarksValues = normalizeValue(
                this.props,
                this.props.trackMarks,
            );

            // eslint-disable-next-line react/no-did-update-set-state
            this.setState({
                trackMarksValues: updateValues({
                    // @ts-ignore
                    values: this.state.trackMarksValues,
                    newValues: newTrackMarksValues,
                }),
            });
        }
    }

    _getRawValues(
        values: Array<Animated.Value> | Array<Animated.AnimatedInterpolation>,
    ) {
        return values.map((value) => value.__getValue());
    }

    _handleStartShouldSetPanResponder = (
        e: any,
    ): /* gestureState: GestureState */
    boolean => this._thumbHitTest(e); // Should we become active when the user presses down on the thumb?

    _handleMoveShouldSetPanResponder(): /* e, gestureState: GestureState */
    boolean {
        // Should we become active when the user moves a touch over the thumb?
        return false;
    }

    _handlePanResponderGrant = (e: {nativeEvent: any}) => {
        const {thumbSize} = this.state;
        const {nativeEvent} = e;
        this._previousLeft = this.props.trackClickable
            ? nativeEvent.locationX - thumbSize.width
            : this._getThumbLeft(this._getCurrentValue(this._activeThumbIndex));

        if (this.props.thumbTouchSize) {
            this._previousLeft -=
                (this.props.thumbTouchSize.width - thumbSize.width) / 2;
        }

        this.props?.onSlidingStart?.(
            this._getRawValues(this.state.values),
            this._activeThumbIndex,
        );
    };

    _handlePanResponderMove = (_e: any, gestureState: any) => {
        if (this.props.disabled) {
            return;
        }

        this._setCurrentValue(
            this._getValue(gestureState),
            this._activeThumbIndex,
            () => {
                this.props?.onValueChange?.(
                    this._getRawValues(this.state.values),
                    this._activeThumbIndex,
                );
            },
        );
    };

    _handlePanResponderRequestEnd = () => /* e, gestureState: GestureState */ {
        // Should we allow another component to take over this pan?
        return false;
    };

    _handlePanResponderEnd = (_e: any, gestureState: any) => {
        if (this.props.disabled) {
            return;
        }

        this._setCurrentValue(
            this._getValue(gestureState),
            this._activeThumbIndex,
            () => {
                if (this.props.trackClickable) {
                    this.props?.onValueChange?.(
                        this._getRawValues(this.state.values),
                        this._activeThumbIndex,
                    );
                }

                this.props?.onSlidingComplete?.(
                    this._getRawValues(this.state.values),
                    this._activeThumbIndex,
                );
            },
        );

        this._activeThumbIndex = 0;
    };

    _measureContainer = (e: LayoutChangeEvent) => {
        this._handleMeasure('_containerSize', e);
    };

    _measureTrack = (e: LayoutChangeEvent) => {
        this._handleMeasure('_trackSize', e);
    };

    _measureThumb = (e: LayoutChangeEvent) => {
        this._handleMeasure('_thumbSize', e);
    };

    _handleMeasure = (
        name: '_containerSize' | '_trackSize' | '_thumbSize',
        e: LayoutChangeEvent,
    ) => {
        const {width, height} = e.nativeEvent.layout;
        const size = {
            width,
            height,
        };

        const currentSize = this[name];

        if (
            currentSize &&
            width === currentSize.width &&
            height === currentSize.height
        ) {
            return;
        }

        this[name] = size;

        if (this._containerSize && this._thumbSize) {
            this.setState({
                containerSize: this._containerSize,
                thumbSize: this._thumbSize,
                allMeasured: true,
            });
        }
    };
    _getRatio = (value: number) => {
        const {maximumValue, minimumValue} = this.props;
        return (value - minimumValue) / (maximumValue - minimumValue);
    };
    _getThumbLeft = (value: number) => {
        const {containerSize, thumbSize} = this.state;
        const {vertical} = this.props;

        const standardRatio = this._getRatio(value);

        const ratio = I18nManager.isRTL ? 1 - standardRatio : standardRatio;
        return (
            ratio *
            ((vertical ? containerSize.height : containerSize.width) -
                thumbSize.width)
        );
    };
    _getValue = (gestureState: {dx: number; dy: number}) => {
        const {containerSize, thumbSize, values} = this.state;
        const {maximumValue, minimumValue, step, vertical} = this.props;
        const length = containerSize.width - thumbSize.width;
        const thumbLeft = vertical
            ? this._previousLeft + gestureState.dy * -1
            : this._previousLeft + gestureState.dx;
        const nonRtlRatio = thumbLeft / length;
        const ratio = I18nManager.isRTL ? 1 - nonRtlRatio : nonRtlRatio;
        let minValue = minimumValue;
        let maxValue = maximumValue;

        const rawValues = this._getRawValues(values);

        const buffer = step ? step : 0.1;

        if (values.length === 2 && !this.props.allowCrossover) {
            if (this._activeThumbIndex === 1) {
                minValue = rawValues[0] + buffer;
            } else {
                maxValue = rawValues[1] - buffer;
            }
        }

        if (step) {
            return Math.max(
                minValue,
                Math.min(
                    maxValue,
                    minimumValue +
                        Math.round(
                            (ratio * (maximumValue - minimumValue)) / step,
                        ) *
                            step,
                ),
            );
        }

        return Math.max(
            minValue,
            Math.min(
                maxValue,
                ratio * (maximumValue - minimumValue) + minimumValue,
            ),
        );
    };
    _getCurrentValue = (thumbIndex: number = 0) =>
        this.state.values[thumbIndex].__getValue();

    _setCurrentValue = (
        value: number,
        thumbIndex: number | null | undefined,
        callback?: () => void,
    ) => {
        const safeIndex = thumbIndex ?? 0;
        const animatedValue = this.state.values[safeIndex];

        // Handle dual slider crossover logic
        if (this.props.dualSlider && this.state.values.length >= 2) {
            const otherIndex = safeIndex === 0 ? 1 : 0;
            const otherValue = this.state.values[otherIndex]?.__getValue() || 0;

            if (!this.props.allowCrossover) {
                // Prevent crossover - clamp values
                if (safeIndex === 0 && value > otherValue) {
                    // Left thumb trying to go past right thumb
                    value = otherValue;
                } else if (safeIndex === 1 && value < otherValue) {
                    // Right thumb trying to go past left thumb
                    value = otherValue;
                }
            }
            // When allowCrossover is true, allow the thumb to move freely without restrictions
        }

        if (animatedValue) {
            animatedValue.setValue(value);

            if (callback) {
                callback();
            }
        } else {
            this.setState((prevState: SliderState) => {
                const newValues = [...prevState.values];
                newValues[safeIndex] = new Animated.Value(value);
                return {
                    values: newValues,
                };
            }, callback);
        }
    };

    _setCurrentValueAnimated = (value: number, thumbIndex: number = 0) => {
        const {animationType} = this.props;
        const animationConfig = {
            ...DEFAULT_ANIMATION_CONFIGS[animationType],
            ...this.props.animationConfig,
            toValue: value,
            useNativeDriver: false,
        };
        Animated[animationType](
            this.state.values[thumbIndex],
            animationConfig,
        ).start();
    };

    _getTouchOverflowSize = (): {
        width: number;
        height: number;
    } => {
        const {allMeasured, containerSize, thumbSize} = this.state;
        const {thumbTouchSize} = this.props;
        const size = {
            width: 40,
            height: 40,
        };

        if (allMeasured) {
            size.width = Math.max(
                0,
                thumbTouchSize?.width || 0 + thumbSize.width,
            );
            size.height = Math.max(
                0,
                thumbTouchSize?.height || 0 - containerSize.height,
            );
        }

        return size;
    };

    _getTouchOverflowStyle = () => {
        const {width, height} = this._getTouchOverflowSize();

        const touchOverflowStyle = {} as ViewStyle;

        if (width !== undefined && height !== undefined) {
            const verticalMargin = -height / 2;
            touchOverflowStyle.marginTop = verticalMargin;
            touchOverflowStyle.marginBottom = verticalMargin;
            const horizontalMargin = -width / 2;
            touchOverflowStyle.marginLeft = horizontalMargin;
            touchOverflowStyle.marginRight = horizontalMargin;
        }

        if (this.props.debugTouchArea === true) {
            touchOverflowStyle.backgroundColor = 'orange';
            touchOverflowStyle.opacity = 0.5;
        }

        return touchOverflowStyle;
    };
    _thumbHitTest = (e: {nativeEvent: any}) => {
        const {nativeEvent} = e;
        const {trackClickable} = this.props;
        const {values} = this.state;
        const hitThumb = values.find((_, i) => {
            const thumbTouchRect = this._getThumbTouchRect(i);

            const containsPoint = thumbTouchRect.containsPoint(
                nativeEvent.locationX,
                nativeEvent.locationY,
            );

            if (containsPoint) {
                this._activeThumbIndex = i;
            }

            return containsPoint;
        });

        if (hitThumb) {
            return true;
        }

        if (trackClickable) {
            // set the active thumb index
            if (values.length === 1) {
                this._activeThumbIndex = 0;
            } else {
                // we will find the closest thumb and that will be the active thumb
                const thumbDistances = values.map((_value, index) => {
                    const thumbTouchRect = this._getThumbTouchRect(index);

                    return thumbTouchRect.trackDistanceToPoint(
                        nativeEvent.locationX,
                    );
                });
                this._activeThumbIndex = indexOfLowest(thumbDistances);
            }

            return true;
        }

        return false;
    };

    _getThumbTouchRect = (thumbIndex: number = 0): RectReturn => {
        const {containerSize, thumbSize} = this.state;
        const {thumbTouchSize} = this.props;
        const {height, width} = thumbTouchSize || {height: 40, width: 40};

        const touchOverflowSize = this._getTouchOverflowSize();

        return Rect({
            height,
            width,
            x:
                touchOverflowSize.width / 2 +
                this._getThumbLeft(this._getCurrentValue(thumbIndex)) +
                (thumbSize.width - width) / 2,
            y:
                touchOverflowSize.height / 2 +
                (containerSize.height - height) / 2,
        });
    };

    _activeThumbIndex: number = 0;
    _containerSize: Dimensions | null | undefined;
    _panResponder: PanResponderInstance;
    _previousLeft: number = 0;
    _thumbSize: Dimensions | null | undefined;
    _trackSize: Dimensions | null | undefined;

    _renderDebugThumbTouchRect = (
        thumbLeft: Animated.AnimatedInterpolation,
        index: number,
    ) => {
        const {height, x, y, width} = this._getThumbTouchRect(index) || {};
        const positionStyle = {
            height,
            left: x,
            top: y,
            width,
        };
        return (
            <Animated.View
                key={`debug-thumb-${index}`}
                pointerEvents="none"
                style={[styles.debugThumbTouchArea, positionStyle]}
            />
        );
    };

    _renderThumbImage = (thumbIndex: number = 0) => {
        const {thumbImage} = this.props;

        if (!thumbImage) {
            return null;
        }

        return (
            <Image
                source={
                    (Array.isArray(thumbImage)
                        ? thumbImage[thumbIndex]
                        : thumbImage) as ImageSourcePropType
                }
            />
        );
    };

    render() {
        const {
            containerStyle,
            debugTouchArea,
            maximumTrackTintColor,
            maximumValue,
            minimumTrackTintColor,
            minimumValue,
            renderAboveThumbComponent,
            renderBelowThumbComponent,
            renderTrackMarkComponent,
            renderThumbComponent,
            renderMinimumTrackComponent,
            renderMaximumTrackComponent,
            thumbStyle,
            thumbTintColor,
            trackStyle,
            minimumTrackStyle: propMinimumTrackStyle,
            maximumTrackStyle: propMaximumTrackStyle,
            vertical,
            startFromZero,
            step = 0,
            trackRightPadding,
            dualSlider,
            allowCrossover,
            rangeTrackStyle,
            rangeTrackTintColor,
            ...other
        } = this.props;
        const {
            allMeasured,
            containerSize,
            thumbSize,
            trackMarksValues,
            values,
        } = this.state;
        const rightPadding = trackRightPadding ?? thumbSize.width;
        const _startFromZero =
            values.length === 1 && minimumValue < 0 && maximumValue > 0
                ? startFromZero
                : false;
        const interpolatedThumbValues = values.map((value) =>
            value.interpolate({
                inputRange: [minimumValue, maximumValue],
                outputRange: I18nManager.isRTL
                    ? [0, -(containerSize.width - rightPadding)]
                    : [0, containerSize.width - rightPadding],
            }),
        );
        const interpolatedTrackValues = values.map((value) =>
            value.interpolate({
                inputRange: [minimumValue, maximumValue],
                outputRange: [0, containerSize.width - rightPadding],
            }),
        );
        const interpolatedTrackMarksValues =
            trackMarksValues &&
            trackMarksValues.map((v) =>
                v.interpolate({
                    inputRange: [minimumValue, maximumValue],
                    outputRange: I18nManager.isRTL
                        ? [0, -(containerSize.width - rightPadding)]
                        : [0, containerSize.width - rightPadding],
                }),
            );
        const valueVisibleStyle = {} as ViewStyle;

        if (!allMeasured) {
            valueVisibleStyle.opacity = 0;
        }

        const _value = values[0].__getValue();
        const sliderWidthCoefficient =
            containerSize.width /
            (Math.abs(minimumValue) + Math.abs(maximumValue));
        const startPositionOnTrack = _startFromZero
            ? _value < 0 + step
                ? (_value + Math.abs(minimumValue)) * sliderWidthCoefficient
                : Math.abs(minimumValue) * sliderWidthCoefficient
            : 0;

        const minTrackWidth = _startFromZero
            ? Math.abs(_value) * sliderWidthCoefficient - thumbSize.width / 2
            : interpolatedTrackValues[0];
        const maxTrackWidth = interpolatedTrackValues[1];
        const clearBorderRadius = {} as ViewStyle;
        if (_startFromZero && _value < 0 + step) {
            clearBorderRadius.borderBottomRightRadius = 0;
            clearBorderRadius.borderTopRightRadius = 0;
        }
        if (_startFromZero && _value > 0) {
            clearBorderRadius.borderTopLeftRadius = 0;
            clearBorderRadius.borderBottomLeftRadius = 0;
        }

        const minimumTrackStyle =
            minimumTrackTintColor === 'transparent'
                ? null
                : ({
                      position: 'absolute',
                      left:
                          interpolatedTrackValues.length === 1
                              ? new Animated.Value(startPositionOnTrack)
                              : Animated.add(
                                    minTrackWidth,
                                    thumbSize.width / 2,
                                ),
                      width:
                          interpolatedTrackValues.length === 1
                              ? Animated.add(minTrackWidth, thumbSize.width / 2)
                              : Animated.add(
                                    Animated.multiply(minTrackWidth, -1),
                                    maxTrackWidth,
                                ),
                      backgroundColor: minimumTrackTintColor,
                      ...valueVisibleStyle,
                      ...clearBorderRadius,
                  } as ViewStyle);

        // 双滑块范围轨道样式
        const dualSliderRangeTrackStyle =
            dualSlider && interpolatedTrackValues.length >= 2
                ? (() => {
                      const pos0 = interpolatedTrackValues[0];
                      const pos1 = interpolatedTrackValues[1];

                      // 判断是否交叉（仅在允许交叉时检查）
                      let isCrossed = false;
                      let leftPos, rightPos;

                      if (allowCrossover) {
                          const currentValue0 =
                              this.state.values[0].__getValue();
                          const currentValue1 =
                              this.state.values[1].__getValue();
                          isCrossed = currentValue0 > currentValue1;
                      }

                      if (isCrossed) {
                          // 交叉：value0 在右边，value1 在左边
                          leftPos = pos1;
                          rightPos = pos0;
                      } else {
                          // 正常：value0 在左边，value1 在右边
                          leftPos = pos0;
                          rightPos = pos1;
                      }

                      // 如果 rangeTrackTintColor 为 transparent，返回 null 不渲染
                      if (rangeTrackTintColor === 'transparent') {
                          return null;
                      }

                      // 创建通用的轨道样式
                      return {
                          position: 'absolute',
                          left: Animated.add(leftPos, thumbSize.width / 2),
                          width: Animated.add(
                              Animated.multiply(leftPos, -1),
                              rightPos,
                          ),
                          backgroundColor: rangeTrackTintColor,
                          ...valueVisibleStyle,
                      } as ViewStyle;
                  })()
                : null;

        // 最大值右侧的未选中区域（仅当底色为透明且选中为透明时渲染）
        const rightUnselectedTrackStyle =
            maximumTrackTintColor !== 'transparent' &&
            (minimumTrackTintColor === 'transparent' ||
                rangeTrackTintColor === 'transparent')
                ? (() => {
                      if (interpolatedTrackValues.length === 1) {
                          // 单滑块：从滑块右侧到轨道右端
                          return {
                              position: 'absolute',
                              top: (containerSize.height - 4) / 2, // 与轨道高度对齐
                              left: Animated.add(
                                  interpolatedTrackValues[0],
                                  thumbSize.width,
                              ),
                              right: 0,
                              height: 4, // 与轨道高度一致
                              backgroundColor: maximumTrackTintColor,
                              ...valueVisibleStyle,
                          } as ViewStyle;
                      } else if (
                          dualSlider &&
                          interpolatedTrackValues.length >= 2
                      ) {
                          // 双滑块：从视觉上最右边的滑块右侧到轨道右端
                          // 需要判断是否交叉
                          let rightmostPos;
                          if (allowCrossover) {
                              const currentValue0 =
                                  this.state.values[0].__getValue();
                              const currentValue1 =
                                  this.state.values[1].__getValue();
                              const isCrossed = currentValue0 > currentValue1;
                              // 交叉时，value0 在右边；否则 value1 在右边
                              rightmostPos = isCrossed
                                  ? interpolatedTrackValues[0]
                                  : interpolatedTrackValues[1];
                          } else {
                              // 未允许交叉，value1 总是在右边
                              rightmostPos = interpolatedTrackValues[1];
                          }

                          return {
                              position: 'absolute',
                              top: (containerSize.height - 4) / 2, // 与轨道高度对齐
                              left: Animated.add(rightmostPos, thumbSize.width),
                              right: 0,
                              height: 4, // 与轨道高度一致
                              backgroundColor: maximumTrackTintColor,
                              ...valueVisibleStyle,
                          } as ViewStyle;
                      }
                      return null;
                  })()
                : null;

        // 最小值左侧的未选中区域（双滑块且透明时）
        const leftUnselectedTrackStyle =
            dualSlider &&
            interpolatedTrackValues.length >= 2 &&
            maximumTrackTintColor !== 'transparent' &&
            (minimumTrackTintColor === 'transparent' ||
                rangeTrackTintColor === 'transparent')
                ? (() => {
                      // 需要判断是否交叉来确定视觉上的最左边位置
                      let leftmostPos;
                      if (allowCrossover) {
                          const currentValue0 =
                              this.state.values[0].__getValue();
                          const currentValue1 =
                              this.state.values[1].__getValue();
                          const isCrossed = currentValue0 > currentValue1;
                          // 交叉时，value1 在左边；否则 value0 在左边
                          leftmostPos = isCrossed
                              ? interpolatedTrackValues[1]
                              : interpolatedTrackValues[0];
                      } else {
                          // 未允许交叉，value0 总是在左边
                          leftmostPos = interpolatedTrackValues[0];
                      }

                      return {
                          position: 'absolute',
                          top: (containerSize.height - 4) / 2, // 与轨道高度对齐
                          left: 0,
                          width: Animated.add(leftmostPos, thumbSize.width / 2),
                          height: 4, // 与轨道高度一致
                          backgroundColor: maximumTrackTintColor,
                          ...valueVisibleStyle,
                      } as ViewStyle;
                  })()
                : null;

        const touchOverflowStyle = this._getTouchOverflowStyle();

        return (
            <>
                {renderAboveThumbComponent && (
                    <View style={styles.aboveThumbComponentsContainer}>
                        {interpolatedThumbValues.map(
                            (interpolationValue, i) => {
                                const animatedValue = values[i] || 0;
                                const value =
                                    animatedValue instanceof Animated.Value
                                        ? animatedValue.__getValue()
                                        : animatedValue;
                                return (
                                    <Animated.View
                                        key={`slider-above-thumb-${i}`}
                                        style={[
                                            styles.renderThumbComponent, // eslint-disable-next-line react-native/no-inline-styles
                                            {
                                                bottom: 0,
                                                left: thumbSize.width / 2,
                                                transform: [
                                                    {
                                                        translateX:
                                                            interpolationValue,
                                                    },
                                                    {
                                                        translateY: 0,
                                                    },
                                                ],
                                                ...valueVisibleStyle,
                                            },
                                        ]}>
                                        {renderAboveThumbComponent(i, value)}
                                    </Animated.View>
                                );
                            },
                        )}
                    </View>
                )}
                <View
                    {...other}
                    style={[
                        styles.container,
                        vertical ? {transform: [{rotate: '-90deg'}]} : {},
                        containerStyle,
                    ]}
                    onLayout={this._measureContainer}>
                    {/* 底层背景 - 仅当底色不为 transparent 且没有使用新的未选中区域时渲染全轨道 */}
                    {maximumTrackTintColor !== 'transparent' &&
                        !(
                            (minimumTrackTintColor === 'transparent' ||
                                rangeTrackTintColor === 'transparent') &&
                            maximumTrackTintColor !== 'transparent'
                        ) && (
                            <View
                                renderToHardwareTextureAndroid
                                style={[
                                    styles.track,
                                    {
                                        backgroundColor: maximumTrackTintColor,
                                    },
                                    trackStyle,
                                    propMaximumTrackStyle,
                                ]}
                                onLayout={this._measureTrack}>
                                {renderMaximumTrackComponent
                                    ? renderMaximumTrackComponent()
                                    : null}
                            </View>
                        )}

                    {minimumTrackStyle && (
                        <Animated.View
                            renderToHardwareTextureAndroid
                            style={[
                                styles.track,
                                trackStyle,
                                minimumTrackStyle,
                                propMinimumTrackStyle,
                            ]}>
                            {renderMinimumTrackComponent
                                ? renderMinimumTrackComponent()
                                : null}
                        </Animated.View>
                    )}

                    {/* 双滑块范围轨道 */}
                    {dualSliderRangeTrackStyle && (
                        <Animated.View
                            renderToHardwareTextureAndroid
                            style={[
                                styles.track,
                                trackStyle,
                                dualSliderRangeTrackStyle,
                                rangeTrackStyle,
                            ]}
                        />
                    )}

                    {/* 最小值左侧的未选中区域 */}
                    {leftUnselectedTrackStyle && (
                        <Animated.View
                            renderToHardwareTextureAndroid
                            style={[
                                styles.track,
                                trackStyle,
                                leftUnselectedTrackStyle,
                            ]}
                        />
                    )}

                    {/* 最大值右侧的未选中区域 */}
                    {rightUnselectedTrackStyle && (
                        <Animated.View
                            renderToHardwareTextureAndroid
                            style={[
                                styles.track,
                                trackStyle,
                                rightUnselectedTrackStyle,
                            ]}
                        />
                    )}

                    {renderTrackMarkComponent &&
                        interpolatedTrackMarksValues &&
                        interpolatedTrackMarksValues.map((value, i) => (
                            <Animated.View
                                key={`track-mark-${i}`}
                                style={[
                                    styles.renderThumbComponent,
                                    {
                                        transform: [
                                            {
                                                translateX: value,
                                            },
                                            {
                                                translateY: 0,
                                            },
                                        ],
                                        ...valueVisibleStyle,
                                    },
                                ]}>
                                {renderTrackMarkComponent(i)}
                            </Animated.View>
                        ))}
                    {interpolatedThumbValues.map((value, i) => (
                        <Animated.View
                            key={`slider-thumb-${i}`}
                            style={[
                                renderThumbComponent
                                    ? styles.renderThumbComponent
                                    : styles.thumb,
                                renderThumbComponent
                                    ? {}
                                    : {
                                          backgroundColor: thumbTintColor,
                                          ...thumbStyle,
                                      },
                                {
                                    transform: [
                                        {
                                            translateX: value,
                                        },
                                        {
                                            translateY: 0,
                                        },
                                    ],
                                    ...valueVisibleStyle,
                                },
                            ]}
                            onLayout={this._measureThumb}>
                            {renderThumbComponent
                                ? Array.isArray(renderThumbComponent)
                                    ? renderThumbComponent[i](i)
                                    : renderThumbComponent(i)
                                : this._renderThumbImage(i)}
                        </Animated.View>
                    ))}
                    <View
                        style={[styles.touchArea, touchOverflowStyle]}
                        {...this._panResponder.panHandlers}>
                        {!!debugTouchArea &&
                            interpolatedThumbValues.map((value, i) =>
                                this._renderDebugThumbTouchRect(value, i),
                            )}
                    </View>
                </View>
                {renderBelowThumbComponent && (
                    <View style={styles.belowThumbComponentsContainer}>
                        {interpolatedThumbValues.map(
                            (interpolationValue, i) => {
                                const animatedValue = values[i] || 0;
                                const value =
                                    animatedValue instanceof Animated.Value
                                        ? animatedValue.__getValue()
                                        : animatedValue;
                                return (
                                    <Animated.View
                                        key={`slider-below-thumb-${i}`}
                                        style={[
                                            styles.renderThumbComponent, // eslint-disable-next-line react-native/no-inline-styles
                                            {
                                                top: 0,
                                                left: thumbSize.width / 2,
                                                transform: [
                                                    {
                                                        translateX:
                                                            interpolationValue,
                                                    },
                                                    {
                                                        translateY: 0,
                                                    },
                                                ],
                                                ...valueVisibleStyle,
                                            },
                                        ]}>
                                        {renderBelowThumbComponent(i, value)}
                                    </Animated.View>
                                );
                            },
                        )}
                    </View>
                )}
            </>
        );
    }
}
