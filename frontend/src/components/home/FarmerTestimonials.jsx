import React from "react";
import { User, Leaf } from "lucide-react";
import OptimizedImg from "../common/OptimizedImg";

export default function FarmerTestimonials({ className = "" }) {
  const testimonials = [
    {
      id: "ramesh-patil",
      name: "Ramesh Patil",
      location: "Nashik, Maharashtra",
      quote:
        "GreenGrocc has given me a better market for my produce. I now get fair prices and regular orders.",
      image: "/assets/testimonials/farmer_ramesh_patil.png",
      produce: "Spinach",
      produceType: "leaf",
    },
    {
      id: "sangita-jadhav",
      name: "Sangita Jadhav",
      location: "Ahmednagar, Maharashtra",
      quote:
        "It is very easy to list my products and manage orders. GreenGrocc has helped me reach more customers.",
      image: "/assets/testimonials/farmer_sangita_jadhav.png",
      produce: "Tomato",
      produceType: "tomato",
    },
    {
      id: "vijay-shinde",
      name: "Vijay Shinde",
      location: "Pune, Maharashtra",
      quote:
        "The collection and payment process is smooth. I can focus on farming while GreenGrocc takes care of the rest.",
      image: "/assets/testimonials/farmer_vijay_shinde.png",
      produce: "Bottle Gourd",
      produceType: "gourd",
    },
  ];

  return (
    <section className={`w-full py-4 sm:py-5 px-3 sm:px-5 lg:px-6 rounded-2xl sm:rounded-3xl bg-[#f4faf5] border border-[#ddeadb] shadow-xs my-3 sm:my-4 ${className}`}>
      {/* Section Header */}
      <div className="flex items-start gap-3 mb-4 sm:mb-5">
        {/* Double Leaf Icon */}
        <div className="shrink-0 mt-0.5">
          <svg className="w-8 h-8 sm:w-9 sm:h-9" viewBox="0 0 36 36" fill="none">
            {/* Left Leaf */}
            <path
              d="M13.5 28C13.5 28 7.5 22.5 8.5 15.5C9.5 8.5 17 6.5 17 6.5C17 6.5 18.5 12.5 17 19.5C15.5 25.5 13.5 28 13.5 28Z"
              fill="#22c55e"
            />
            {/* Right Leaf */}
            <path
              d="M15 29C15 29 25 24 26 15C27 6 18 3 18 3C18 3 15 9 15.5 17C16 25 15 29 15 29Z"
              fill="#15803d"
            />
            {/* Stem */}
            <path
              d="M14 28.5C13.5 31 12 33 10.5 34"
              stroke="#15803d"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold tracking-tight leading-tight">
            <span className="text-[#0d3b1e]">Farmer </span>
            <span className="text-[#15803d]">Testimonials</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            Real stories from our farmers who grow with us
          </p>
        </div>
      </div>

      {/* Testimonials Cards Grid / Mobile Horizontal Scroll */}
      <div className="flex md:grid md:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5 overflow-x-auto pb-2 md:pb-0 scrollbar-none snap-x snap-mandatory">
        {testimonials.map((item) => (
          <div
            key={item.id}
            className="min-w-[290px] sm:min-w-[320px] md:min-w-0 shrink-0 md:shrink snap-center bg-white rounded-2xl border border-[#e2efe5] shadow-xs hover:shadow-md transition-all duration-200 p-3 sm:p-3.5 flex gap-3 sm:gap-3.5 items-stretch group"
          >
            {/* Farmer Photo */}
            <div className="w-[105px] sm:w-[120px] lg:w-[125px] shrink-0 rounded-xl overflow-hidden bg-emerald-50/50">
              <OptimizedImg
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            </div>

            {/* Testimonial Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              <div>
                {/* Green Quote Mark Icon */}
                <div className="w-6 h-6 rounded-md bg-[#eef8f1] text-[#0a6c38] flex items-center justify-center mb-1.5">
                  <svg className="w-3.5 h-3.5 fill-[#0a6c38]" viewBox="0 0 24 24">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                </div>

                {/* Quote Text */}
                <p className="text-[11.5px] sm:text-xs text-gray-700 leading-snug sm:leading-relaxed font-medium line-clamp-4">
                  “{item.quote}”
                </p>
              </div>

              {/* Farmer Info & Produce Badge */}
              <div className="mt-2.5 pt-2 border-t border-gray-100/80 flex flex-col gap-1.5">
                {/* Farmer Name & Location */}
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-[#0a6c38] shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs sm:text-[13px] text-gray-900 leading-tight truncate">
                      {item.name}
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-gray-500 leading-tight truncate">
                      {item.location}
                    </p>
                  </div>
                </div>

                {/* Produce Badge */}
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#f0f8f2] text-[#0a6c38] text-[10.5px] sm:text-[11px] font-semibold border border-emerald-200/50">
                    {item.produceType === "leaf" && (
                      <Leaf className="w-3 h-3 text-[#15803d]" />
                    )}
                    {item.produceType === "tomato" && (
                      <span className="text-xs leading-none">🍅</span>
                    )}
                    {item.produceType === "gourd" && (
                      <span className="text-xs leading-none">🍐</span>
                    )}
                    <span>{item.produce}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
