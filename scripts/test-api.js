const fetch = require("node-fetch");

async function test() {
  const id = "7d4b5512-dd3d-40f3-b78a-560d0ecea9d3";
  
  // mock user payload exactly
  const payload = {
    transportCharge: 100,
    otherCharges: 50,
    weighingLoadingCharge: 25,
    deliveryCharge: 30,
    testingCharge: 20
  };

  const res = await fetch("http://localhost:3000/api/proforma-invoices/" + id, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      // Cookie is needed. I'll get it from Prisma.
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log("Response:", data);
}
test();
