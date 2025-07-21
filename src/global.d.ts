// import PocketBase from 'pocketbase';
import type { KeycloakUserJwt } from "$lib/types";

declare global {
  declare namespace App {
    interface Locals {
      pb: import("pocketbase").default;
      settings: any;
    }
  }
}
