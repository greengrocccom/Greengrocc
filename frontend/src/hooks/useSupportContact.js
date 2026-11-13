import { useEffect, useState } from "react";
import { getSupportContact } from "../api/api";
import {
  CONTACT_ADDRESS,
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_TEL,
  CONTACT_WHATSAPP_URL,
} from "../config/contact";

export const FALLBACK_SUPPORT_CONTACT = {
  phone: CONTACT_PHONE_DISPLAY,
  phoneTel: CONTACT_PHONE_TEL,
  whatsapp: CONTACT_PHONE_DISPLAY,
  whatsappHref: CONTACT_WHATSAPP_URL,
  email: CONTACT_EMAIL,
  hours: "Mon – Sat · 10 AM – 10 PM",
  address: `${CONTACT_ADDRESS}, Mumbai, Maharashtra`,
};

let cached = null;
let inflight = null;

function loadSupportContact() {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = getSupportContact()
      .then((res) => {
        const data = res?.data;
        if (!data?.success) return FALLBACK_SUPPORT_CONTACT;
        cached = {
          phone: data.phone || FALLBACK_SUPPORT_CONTACT.phone,
          phoneTel: data.phoneTel || FALLBACK_SUPPORT_CONTACT.phoneTel,
          whatsapp: data.whatsapp || FALLBACK_SUPPORT_CONTACT.whatsapp,
          whatsappHref: data.whatsappHref || FALLBACK_SUPPORT_CONTACT.whatsappHref,
          email: data.email || FALLBACK_SUPPORT_CONTACT.email,
          hours: data.hours || FALLBACK_SUPPORT_CONTACT.hours,
          address: data.address || FALLBACK_SUPPORT_CONTACT.address,
        };
        return cached;
      })
      .catch(() => FALLBACK_SUPPORT_CONTACT)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Platform contact details managed from Admin → Vendors Support Editor → Configure Default. */
export default function useSupportContact() {
  const [contact, setContact] = useState(cached || FALLBACK_SUPPORT_CONTACT);

  useEffect(() => {
    let alive = true;
    loadSupportContact().then((data) => {
      if (alive) setContact(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  return contact;
}
