"use client";

// "Are you sure?" popup (SweetAlert2), styled to match the app. Loaded on
// first use, so it adds nothing to page loads. Resolves true on confirm.
export async function confirmAction({
  title,
  text,
  confirmText,
  tone = "primary",
}: {
  title: string;
  text?: string;
  confirmText: string;
  tone?: "primary" | "danger";
}): Promise<boolean> {
  const { default: Swal } = await import("sweetalert2");
  const result = await Swal.fire({
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancel",
    reverseButtons: true,
    focusCancel: tone === "danger",
    buttonsStyling: false,
    customClass: {
      popup: "!rounded-[24px] !px-4 !pb-5 !pt-6 font-sf-pro-display",
      title: "!p-0 !text-[18px] !font-medium !leading-6 !text-[#2B2B2B]",
      htmlContainer: "!mx-0 !mt-2 !text-[13px] !leading-5 !text-[#839297]",
      actions: "!mt-6 !w-full !flex-nowrap !gap-2.5",
      confirmButton: `!m-0 h-11 flex-1 rounded-full text-[15px] ${
        tone === "danger" ? "bg-[#FFEBEC] text-[#FC383A]" : "bg-[#00C2CE] text-white"
      }`,
      cancelButton: "!m-0 h-11 flex-1 rounded-full bg-[#F5F5F5] text-[15px] text-[#839297]",
    },
  });
  return result.isConfirmed;
}
