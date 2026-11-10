import PolicyPage from "../components/legal/PolicyPage";
import { SHIPPING_BODY } from "../data/policyDefaults";

function ShippingDetails() {
  return (
    <PolicyPage pageKey="shipping" defaultTitle="Shipping & Delivery Policy" fallbackBody={SHIPPING_BODY} />
  );
}

export default ShippingDetails;
