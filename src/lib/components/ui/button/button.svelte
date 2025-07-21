<script lang="ts">
  import { type Props, buttonVariants } from "./index.js";
  import { cn } from "$lib/utils.js";

  type $$Props = Props;

  let className: $$Props["class"] = undefined;
  export let variant: $$Props["variant"] = "default";
  export let size: $$Props["size"] = "default";
  export let type: "button" | "submit" | "reset" = "button";
  export let disabled: boolean = false;
  export { className as class };
</script>

<button
  {type}
  {disabled}
  class={cn(buttonVariants({ variant, size }), className)}
  {...$$restProps}
  on:click
  on:keydown
>
  <slot />
</button>