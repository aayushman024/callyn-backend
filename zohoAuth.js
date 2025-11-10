import express from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "./userModel.js";

dotenv.config();
const router = express.Router();

// Step 1: Redirect user to Zoho login
router.get("/zoho", (req, res) => {
  const redirectUrl = req.query.redirect || process.env.DEFAULT_FRONTEND_URL;
  const state = encodeURIComponent(JSON.stringify({ redirectUrl }));
  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=${process.env.ZOHO_CLIENT_ID}&scope=profile,email,ZOHOPEOPLE.forms.ALL&redirect_uri=${process.env.ZOHO_REDIRECT_URI}&access_type=offline&state=${state}`;
  res.json({ authUrl: authUrl })
});

// Step 2: Handle Zoho callback
router.get("/zoho/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state ? JSON.parse(decodeURIComponent(req.query.state)) : {};
  const redirectUrl = state.redirectUrl || process.env.DEFAULT_FRONTEND_URL;

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post("https://accounts.zoho.com/oauth/v2/token", null, {
      params: {
        grant_type: "authorization_code",
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        redirect_uri: process.env.ZOHO_REDIRECT_URI,
        code,
      },
    });

    const { access_token, id_token } = tokenResponse.data;
    const decoded = jwt.decode(id_token);
    const userEmail = decoded.email;

    // Fetch user info from Zoho People API
    const peopleResponse = await axios.get(
      `https://people.zoho.com/people/api/forms/P_EmployeeView/records`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${access_token}` },
        params: { searchColumn: "EMPLOYEEMAILALIAS", searchValue: userEmail },
      }
    );

    if (!peopleResponse.data || !Array.isArray(peopleResponse.data) || peopleResponse.data.length === 0)
      throw new Error("User not found in Zoho People API");

    const zohoUser = peopleResponse.data[0];
    const email = zohoUser["Email ID"];
    const name = `${zohoUser["First Name"]} ${zohoUser["Last Name"]}`.trim();

    // Check DB user or create new one
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ name, email });
    }

    // Generate JWT token (expires in 1 hour)
    const jwtToken = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Redirect back to frontend with token
    res.redirect(`${redirectUrl}?token=${jwtToken}`);
  } catch (error) {
    console.error("Zoho login failed:", error.message);
    res.redirect(`${redirectUrl}?login=failed`);
  }
});

export default router;
