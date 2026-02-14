import { z } from "zod";

export const PropertyCreateSchema = z.object({
  property_code: z.string().min(1),
  building_name: z.string().min(1),
  address: z.string().min(1),
  status: z.enum(["available", "sold", "rented"]),
  view_method: z.string().min(1), // 内見方法
  manager_name: z.string().min(1), // 担当者
  manager_email: z.string().email(), // 担当者メール
});

export const InquirySchema = z.object({
  property_id: z.string().uuid(),
  via: z.string().optional().default(""),

  company_name: z.string().min(1),
  company_phone: z.string().min(1),
  person_name: z.string().min(1),
  person_mobile: z.string().min(1),
  person_gmail: z.string().email(),
  tanto_name: z.string().optional(),

  inquiry_type: z.enum(["viewing","purchase","other"]),
  visit_datetime: z.string().optional().default(""),

  purchase_file_url: z.string().optional().default(""),
  business_card_url: z.string().min(1),

  other_text: z.string().optional().default("")
}).superRefine((v, ctx) => {
  if (v.inquiry_type === "viewing") {
    if (!v.visit_datetime) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["visit_datetime"], message: "visit_datetime required for viewing" });
  }
  if (v.inquiry_type === "purchase") {
    if (!v.purchase_file_url) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["purchase_file_url"], message: "purchase file required for purchase" });
  }
});
