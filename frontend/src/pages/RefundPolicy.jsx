import PolicyPage from "../components/legal/PolicyPage";
import { REFUND_BODY } from "../data/policyDefaults";

function RefundPolicy() {
  return <PolicyPage pageKey="refund" defaultTitle="Return & Refund Policy" fallbackBody={REFUND_BODY} />;
}

export default RefundPolicy;
