import * as React from "react";
import { FormSelect } from "@/components/ui/select";

interface FrequencySelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function IncomeFrequencySelect({ className, ...props }: FrequencySelectProps) {
  return (
    <FormSelect
      className={className}
      name={props.name}
      value={typeof props.value === "string" ? props.value : undefined}
      defaultValue={typeof props.defaultValue === "string" ? props.defaultValue : undefined}
      onValueChange={(value) => {
        props.onChange?.({
          target: { value },
          currentTarget: { value },
        } as React.ChangeEvent<HTMLSelectElement>);
      }}
      disabled={props.disabled}
      required={props.required}
      options={[
        { value: "weekly", label: "Semanal" },
        { value: "bi-weekly", label: "Quincenal" },
        { value: "monthly", label: "Mensual" },
      ]}
    />
  );
}

export function SubscriptionFrequencySelect({ className, ...props }: FrequencySelectProps) {
  return (
    <FormSelect
      className={className}
      name={props.name}
      value={typeof props.value === "string" ? props.value : undefined}
      defaultValue={typeof props.defaultValue === "string" ? props.defaultValue : undefined}
      onValueChange={(value) => {
        props.onChange?.({
          target: { value },
          currentTarget: { value },
        } as React.ChangeEvent<HTMLSelectElement>);
      }}
      disabled={props.disabled}
      required={props.required}
      options={[
        { value: "daily", label: "Diario" },
        { value: "weekly", label: "Semanal" },
        { value: "bi-weekly", label: "Quincenal" },
        { value: "monthly", label: "Mensual" },
      ]}
    />
  );
}
