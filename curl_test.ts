import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import fs from "fs";
const prisma = new PrismaClient();

async function run() {
  const envData = fs.readFileSync(".env", "utf8");
  const secretLine = envData.split("\n").find(l => l.startsWith("JWT_SECRET="));
  let JWT_SECRET = secretLine ? secretLine.substring(secretLine.indexOf("=") + 1).trim() : "";
  if (JWT_SECRET.startsWith('"') && JWT_SECRET.endsWith('"')) {
    JWT_SECRET = JWT_SECRET.slice(1, -1);
  }

  const v1User = await prisma.user.findFirst({
    where: { email: "exec1@sukisoftware.com" },
    include: { company: true }
  });

  const token = jwt.sign(
    {
      id: v1User?.id,
      userId: v1User?.id,
      email: v1User?.email,
      role: v1User?.role,
      companyId: v1User?.companyId,
      variant: 1, // FORCE variant 1
    },
    JWT_SECRET,
    { expiresIn: "1d" }
  );

  console.log("Making fetch request with V1 token cookie to /api/visits...");
  const res = await fetch("http://localhost:3000/api/visits", {
    headers: {
      "Cookie": `token=${token}`
    }
  });

  console.log(`Status: ${res.status}`);
  const body = await res.text();
  console.log(`Body: ${body}`);
  
  console.log("Making fetch request with V1 token cookie to /api/rfq...");
  const resRfq = await fetch("http://localhost:3000/api/rfq", {
    headers: {
      "Cookie": `token=${token}`
    }
  });

  console.log(`Status: ${resRfq.status}`);
  const bodyRfq = await resRfq.text();
  console.log(`Body: ${bodyRfq}`);
  
  // also get the dashboard API
  console.log("Making fetch request with V1 token cookie to /api/dashboard/manager...");
  const resDash = await fetch("http://localhost:3000/api/dashboard/manager", {
    headers: {
      "Cookie": `token=${token}`
    }
  });

  console.log(`Status: ${resDash.status}`);
  const bodyDash = await resDash.text();
  console.log(`Body: ${bodyDash}`);
}

run();
