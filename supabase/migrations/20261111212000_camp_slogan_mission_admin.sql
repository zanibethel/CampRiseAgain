-- Add dedicated administrator-editable slogan and mission statement to the
-- existing, RLS-protected Camp Rise Again site settings record.
alter table public.camp_rise_again_site_settings
  add column if not exists slogan text not null default 'Camp Rise Again: Honor the Lost. Protect the Living.',
  add column if not exists mission_statement text not null default 'At Camp Rise Again, our mission is simple: honor the lost and protect the living. We bring men into the wild to break the isolation, confront men''s mental health head-on, and build a powerful community where staying in the fight is the only option.';

-- The earlier homepage release placed the slogan in the headline and mission
-- in About. Move only that known copy to its separate fields, respecting any
-- edits made by the camp administrators since that release.
update public.camp_rise_again_site_settings
set hero_heading = case
      when hero_heading = 'Honor the Lost. Protect the Living.'
        then 'You don’t have to walk through the darkness alone.'
      else hero_heading end,
    hero_lead = case
      when hero_lead = 'Camp Rise Again is a men''s mental health camp built around connection, encouragement, and hope. You don''t have to walk through the darkness alone.' then 'Camp Rise Again is a men''s mental health peer-support camp for adult men who may be struggling with depression, isolation, or disconnection. Through outdoor experiences and supportive community, we create space to reconnect, be heard, and find hope.'
      else hero_lead end,
    about_heading = case
      when about_heading = 'Our Mission'
        then 'A safe, supportive place to reconnect with life and with others.'
      else about_heading end,
    about_copy = case
      when about_copy like 'At Camp Rise Again, our mission is simple:%'
        then 'Our goal is to provide a safe, supportive environment where men can step away from the weight of everyday life, connect with people who understand, and experience moments of joy, laughter, connection, and hope.

Through outdoor activities, recreation, group conversations, wellness experiences, and supportive community, Camp Rise Again creates space for men to breathe, be seen, and remember that their lives have value.

This isn''t about pretending everything is okay. It''s about creating a space where you don''t have to pretend.

Camp Rise Again is a community of men choosing to take another step forward—together.

Camp Rise Again is a peer-support experience built around connection, encouragement, and shared activities. It is not a clinical mental-health treatment program and does not replace professional counseling, medical care, or crisis services.'
      else about_copy end,
    donate_copy = case
      when donate_copy = 'Every contribution helps us create a supportive camp experience focused on men''s mental health, connection, and hope. Visit our GoFundMe to donate and see the latest fundraising progress.'
        then 'Every contribution helps us continue building a welcoming, supportive camp experience for men facing depression and isolation. Visit our GoFundMe to donate and see the latest fundraising progress.'
      else donate_copy end
where id = 1;
