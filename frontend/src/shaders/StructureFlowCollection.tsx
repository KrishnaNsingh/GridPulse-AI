import { DataField, type NeuformIsolatedEffectProps } from './neuform-isolated/NeuformIsolatedEffects';
import './threeui.css';

export interface StructureFlowCollectionProps extends NeuformIsolatedEffectProps {
  variant?: 'data-field' | string;
}

export function StructureFlowCollection({
  variant = 'data-field',
  hue = 0,
  saturation = 1.0,
  brightness = 1.0,
  className,
  style,
  ...props
}: StructureFlowCollectionProps) {
  if (variant === 'data-field') {
    return (
      <DataField
        hue={hue}
        saturation={saturation}
        brightness={brightness}
        className={className}
        style={style}
        {...props}
      />
    );
  }
  return (
    <DataField
      hue={hue}
      saturation={saturation}
      brightness={brightness}
      className={className}
      style={style}
      {...props}
    />
  );
}

export default StructureFlowCollection;
