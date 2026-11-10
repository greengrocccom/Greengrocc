import PolicyPage from "../components/legal/PolicyPage";
import { PRIVACY_BODY } from "../data/policyDefaults";

function PrivacyPolicy() {
  return <PolicyPage pageKey="privacy" defaultTitle="Privacy Policy" fallbackBody={PRIVACY_BODY} />;
}

export default PrivacyPolicy;
