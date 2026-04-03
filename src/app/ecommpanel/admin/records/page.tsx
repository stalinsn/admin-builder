import { redirect } from "next/navigation";

export default function EcommPanelDataRecordsRedirectPage() {
  redirect("/ecommpanel/admin/data?module=records");
}
