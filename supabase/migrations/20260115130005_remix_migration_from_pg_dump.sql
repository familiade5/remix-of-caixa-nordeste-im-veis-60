CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.properties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    external_id text,
    title text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    price numeric NOT NULL,
    original_price numeric,
    discount numeric,
    address_street text,
    address_neighborhood text NOT NULL,
    address_city text NOT NULL,
    address_state text NOT NULL,
    address_zipcode text,
    bedrooms integer,
    bathrooms integer,
    area numeric NOT NULL,
    parking_spaces integer,
    images text[] DEFAULT '{}'::text[],
    description text,
    accepts_fgts boolean DEFAULT false,
    accepts_financing boolean DEFAULT false,
    auction_date date,
    modality text,
    caixa_link text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sold_at timestamp with time zone,
    CONSTRAINT properties_address_state_check CHECK ((address_state = ANY (ARRAY['AL'::text, 'BA'::text, 'CE'::text, 'MA'::text, 'PB'::text, 'PE'::text, 'PI'::text, 'RN'::text, 'SE'::text]))),
    CONSTRAINT properties_status_check CHECK ((status = ANY (ARRAY['available'::text, 'sold'::text]))),
    CONSTRAINT properties_type_check CHECK ((type = ANY (ARRAY['casa'::text, 'apartamento'::text, 'terreno'::text, 'comercial'::text])))
);


--
-- Name: scraping_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraping_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    states text[] DEFAULT '{AL,BA,CE,MA,PB,PE,PI,RN,SE}'::text[],
    property_types text[] DEFAULT '{casa,apartamento,terreno,comercial}'::text[],
    modalities text[] DEFAULT '{"Venda Direta Online","Leilão SFI - Edital Único"}'::text[],
    min_price numeric DEFAULT 0,
    max_price numeric DEFAULT 1000000,
    is_active boolean DEFAULT true,
    last_run_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scraping_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scraping_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_id uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status text DEFAULT 'running'::text NOT NULL,
    properties_found integer DEFAULT 0,
    properties_new integer DEFAULT 0,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scraping_logs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: staging_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_properties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    external_id text NOT NULL,
    raw_data jsonb NOT NULL,
    title text,
    type text,
    price numeric,
    original_price numeric,
    discount numeric,
    address_neighborhood text,
    address_city text,
    address_state text,
    bedrooms integer,
    bathrooms integer,
    area numeric,
    parking_spaces integer,
    images text[] DEFAULT '{}'::text[],
    description text,
    accepts_fgts boolean DEFAULT false,
    accepts_financing boolean DEFAULT false,
    auction_date date,
    modality text,
    caixa_link text,
    status text DEFAULT 'pending'::text NOT NULL,
    scraped_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staging_properties_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'imported'::text, 'ignored'::text])))
);


--
-- Name: properties properties_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_external_id_key UNIQUE (external_id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: scraping_config scraping_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraping_config
    ADD CONSTRAINT scraping_config_pkey PRIMARY KEY (id);


--
-- Name: scraping_logs scraping_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraping_logs
    ADD CONSTRAINT scraping_logs_pkey PRIMARY KEY (id);


--
-- Name: staging_properties staging_properties_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_properties
    ADD CONSTRAINT staging_properties_external_id_key UNIQUE (external_id);


--
-- Name: staging_properties staging_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_properties
    ADD CONSTRAINT staging_properties_pkey PRIMARY KEY (id);


--
-- Name: properties update_properties_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: scraping_config update_scraping_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_scraping_config_updated_at BEFORE UPDATE ON public.scraping_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: scraping_logs scraping_logs_config_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scraping_logs
    ADD CONSTRAINT scraping_logs_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.scraping_config(id) ON DELETE CASCADE;


--
-- Name: properties Properties are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Properties are viewable by everyone" ON public.properties FOR SELECT USING (true);


--
-- Name: scraping_config Scraping config viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scraping config viewable by everyone" ON public.scraping_config FOR SELECT USING (true);


--
-- Name: scraping_logs Scraping logs viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scraping logs viewable by everyone" ON public.scraping_logs FOR SELECT USING (true);


--
-- Name: staging_properties Staging properties viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staging properties viewable by everyone" ON public.staging_properties FOR SELECT USING (true);


--
-- Name: properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

--
-- Name: scraping_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraping_config ENABLE ROW LEVEL SECURITY;

--
-- Name: scraping_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scraping_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: staging_properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staging_properties ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;