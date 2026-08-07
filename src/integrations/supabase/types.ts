export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      addon_groups: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          max_selections: number
          name: string
          restaurant_id: string | null
          sort_order: number
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_selections?: number
          name: string
          restaurant_id?: string | null
          sort_order?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_selections?: number
          name?: string
          restaurant_id?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addon_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      addon_options: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_available: boolean
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_available?: boolean
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_available?: boolean
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "addon_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_knowledge_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          restaurant_id: string
          source_label: string | null
          source_type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          restaurant_id: string
          source_label?: string | null
          source_type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          restaurant_id?: string
          source_label?: string | null
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_chunks_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_knowledge_chunks_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_safety_limits: {
        Row: {
          abandoned_followup_enabled: boolean | null
          abandoned_followup_minutes: number | null
          cancel_max_value_cents: number
          max_cost_cents_per_day: number
          max_messages_per_contact_per_hour: number | null
          max_tool_executions_per_day: number
          nps_after_delivery_enabled: boolean | null
          nps_delay_minutes: number | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          abandoned_followup_enabled?: boolean | null
          abandoned_followup_minutes?: number | null
          cancel_max_value_cents?: number
          max_cost_cents_per_day?: number
          max_messages_per_contact_per_hour?: number | null
          max_tool_executions_per_day?: number
          nps_after_delivery_enabled?: boolean | null
          nps_delay_minutes?: number | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          abandoned_followup_enabled?: boolean | null
          abandoned_followup_minutes?: number | null
          cancel_max_value_cents?: number
          max_cost_cents_per_day?: number
          max_messages_per_contact_per_hour?: number | null
          max_tool_executions_per_day?: number
          nps_after_delivery_enabled?: boolean | null
          nps_delay_minutes?: number | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_safety_limits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_safety_limits_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_status_dispatches: {
        Row: {
          id: string
          order_id: number
          restaurant_id: string
          sent_at: string
          status: string
          wa_message_id: string | null
        }
        Insert: {
          id?: string
          order_id: number
          restaurant_id: string
          sent_at?: string
          status: string
          wa_message_id?: string | null
        }
        Update: {
          id?: string
          order_id?: number
          restaurant_id?: string
          sent_at?: string
          status?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_status_dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_status_dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_status_dispatches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_status_dispatches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tool_executions: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          channel: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          estimated_cost_cents: number
          id: string
          input: Json | null
          output: Json | null
          restaurant_id: string
          success: boolean
          tool_name: string
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          channel?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost_cents?: number
          id?: string
          input?: Json | null
          output?: Json | null
          restaurant_id: string
          success: boolean
          tool_name: string
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          channel?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost_cents?: number
          id?: string
          input?: Json | null
          output?: Json | null
          restaurant_id?: string
          success?: boolean
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tool_executions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "restaurant_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tool_executions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_tool_executions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_training_examples: {
        Row: {
          agent_id: string | null
          bad_assistant_message: string | null
          created_at: string
          good_assistant_message: string
          id: string
          is_active: boolean
          note: string | null
          restaurant_id: string
          updated_at: string
          user_message: string
        }
        Insert: {
          agent_id?: string | null
          bad_assistant_message?: string | null
          created_at?: string
          good_assistant_message: string
          id?: string
          is_active?: boolean
          note?: string | null
          restaurant_id: string
          updated_at?: string
          user_message: string
        }
        Update: {
          agent_id?: string | null
          bad_assistant_message?: string | null
          created_at?: string
          good_assistant_message?: string
          id?: string
          is_active?: boolean
          note?: string | null
          restaurant_id?: string
          updated_at?: string
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_training_examples_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "restaurant_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_training_examples_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_training_examples_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_image_enhancements: {
        Row: {
          created_at: string
          enhanced_url: string | null
          error_message: string | null
          id: string
          original_url: string | null
          prompt_used: string | null
          restaurant_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          enhanced_url?: string | null
          error_message?: string | null
          id?: string
          original_url?: string | null
          prompt_used?: string | null
          restaurant_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          enhanced_url?: string | null
          error_message?: string | null
          id?: string
          original_url?: string | null
          prompt_used?: string | null
          restaurant_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_image_enhancements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_image_enhancements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_outreach_queue: {
        Row: {
          agent_id: string | null
          contact_id: string
          conversation_id: string | null
          created_at: string
          extra_context: string | null
          followup_interval_hours: number
          followups_sent: number
          id: string
          max_followups: number
          next_run_at: string
          objective: string
          restaurant_id: string
          snapshot: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          contact_id: string
          conversation_id?: string | null
          created_at?: string
          extra_context?: string | null
          followup_interval_hours?: number
          followups_sent?: number
          id?: string
          max_followups?: number
          next_run_at: string
          objective: string
          restaurant_id: string
          snapshot?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          contact_id?: string
          conversation_id?: string | null
          created_at?: string
          extra_context?: string | null
          followup_interval_hours?: number
          followups_sent?: number
          id?: string
          max_followups?: number
          next_run_at?: string
          objective?: string
          restaurant_id?: string
          snapshot?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_outreach_queue_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "restaurant_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_outreach_queue_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_outreach_queue_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_debounce: {
        Row: {
          conversation_id: string
          created_at: string
          fire_at: string
          restaurant_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          fire_at: string
          restaurant_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          fire_at?: string
          restaurant_id?: string
        }
        Relationships: []
      }
      bot_response_claims: {
        Row: {
          conversation_id: string
          created_at: string
          inbound_message_id: string
          restaurant_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          inbound_message_id: string
          restaurant_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          inbound_message_id?: string
          restaurant_id?: string
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          close_time: string
          created_at: string
          day_of_week: number
          id: string
          is_active: boolean
          open_time: string
          restaurant_id: string | null
        }
        Insert: {
          close_time: string
          created_at?: string
          day_of_week: number
          id?: string
          is_active?: boolean
          open_time: string
          restaurant_id?: string | null
        }
        Update: {
          close_time?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_active?: boolean
          open_time?: string
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      business_type_defaults: {
        Row: {
          business_type: string
          capabilities: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          business_type: string
          capabilities?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          business_type?: string
          capabilities?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          restaurant_id: string
          session_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          restaurant_id: string
          session_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          restaurant_id?: string
          session_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_notes: string | null
          counted_amounts: Json | null
          created_at: string
          difference: number | null
          expected_amounts: Json | null
          id: string
          opened_at: string
          opened_by: string
          opening_amount: number
          opening_notes: string | null
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          counted_amounts?: Json | null
          created_at?: string
          difference?: number | null
          expected_amounts?: Json | null
          id?: string
          opened_at?: string
          opened_by: string
          opening_amount?: number
          opening_notes?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          counted_amounts?: Json | null
          created_at?: string
          difference?: number | null
          expected_amounts?: Json | null
          id?: string
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          opening_notes?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          department: string
          id: string
          image_url: string | null
          name: string
          restaurant_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          department?: string
          id?: string
          image_url?: string | null
          name: string
          restaurant_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          image_url?: string | null
          name?: string
          restaurant_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          created_at: string
          id: string
          message: string
          restaurant_id: string
          sent_at: string
          sent_by: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          restaurant_id: string
          sent_at?: string
          sent_by: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          restaurant_id?: string
          sent_at?: string
          sent_by?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_value: number | null
          restaurant_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_value?: number | null
          restaurant_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_value?: number | null
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          complement: string | null
          created_at: string
          customer_phone: string
          id: string
          is_default: boolean
          label: string
          neighborhood: string
          number: string
          reference: string | null
          restaurant_id: string | null
          street: string
          updated_at: string
        }
        Insert: {
          complement?: string | null
          created_at?: string
          customer_phone: string
          id?: string
          is_default?: boolean
          label?: string
          neighborhood: string
          number: string
          reference?: string | null
          restaurant_id?: string | null
          street: string
          updated_at?: string
        }
        Update: {
          complement?: string | null
          created_at?: string
          customer_phone?: string
          id?: string
          is_default?: boolean
          label?: string
          neighborhood?: string
          number?: string
          reference?: string | null
          restaurant_id?: string | null
          street?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_assignments: {
        Row: {
          commission_amount: number | null
          created_at: string
          delivered_at: string | null
          distance_km: number | null
          driver_id: string
          id: string
          notes: string | null
          offered_at: string
          order_id: number
          picked_up_at: string | null
          responded_at: string | null
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          commission_amount?: number | null
          created_at?: string
          delivered_at?: string | null
          distance_km?: number | null
          driver_id: string
          id?: string
          notes?: string | null
          offered_at?: string
          order_id: number
          picked_up_at?: string | null
          responded_at?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          commission_amount?: number | null
          created_at?: string
          delivered_at?: string | null
          distance_km?: number | null
          driver_id?: string
          id?: string
          notes?: string | null
          offered_at?: string
          order_id?: number
          picked_up_at?: string | null
          responded_at?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_driver_locations: {
        Row: {
          accuracy: number | null
          driver_id: string
          heading: number | null
          lat: number
          lng: number
          restaurant_id: string
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          driver_id: string
          heading?: number | null
          lat: number
          lng: number
          restaurant_id: string
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          driver_id?: string
          heading?: number | null
          lat?: number
          lng?: number
          restaurant_id?: string
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_driver_locations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_driver_locations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_driver_shifts: {
        Row: {
          cash_collected: number
          closed_at: string | null
          commission_total: number
          created_at: string
          deliveries_count: number
          driver_id: string
          id: string
          notes: string | null
          opened_at: string
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cash_collected?: number
          closed_at?: string | null
          commission_total?: number
          created_at?: string
          deliveries_count?: number
          driver_id: string
          id?: string
          notes?: string | null
          opened_at?: string
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cash_collected?: number
          closed_at?: string | null
          commission_total?: number
          created_at?: string
          deliveries_count?: number
          driver_id?: string
          id?: string
          notes?: string | null
          opened_at?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_driver_shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_driver_shifts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_driver_shifts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_drivers: {
        Row: {
          commission_type: string
          commission_value: number
          cpf: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string
          photo_url: string | null
          pin: string
          pix_key: string | null
          restaurant_id: string
          status: string
          updated_at: string
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_type: string
        }
        Insert: {
          commission_type?: string
          commission_value?: number
          cpf?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone: string
          photo_url?: string | null
          pin: string
          pix_key?: string | null
          restaurant_id: string
          status?: string
          updated_at?: string
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Update: {
          commission_type?: string
          commission_value?: number
          cpf?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string
          photo_url?: string | null
          pin?: string
          pix_key?: string | null
          restaurant_id?: string
          status?: string
          updated_at?: string
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_drivers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_drivers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_ratings: {
        Row: {
          comment: string | null
          created_at: string
          driver_id: string
          id: string
          order_id: number
          restaurant_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          driver_id: string
          id?: string
          order_id: number
          restaurant_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          order_id?: number
          restaurant_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_ratings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          created_at: string
          fee: number
          id: string
          is_active: boolean
          min_order_value: number | null
          name: string
          restaurant_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee?: number
          id?: string
          is_active?: boolean
          min_order_value?: number | null
          name: string
          restaurant_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee?: number
          id?: string
          is_active?: boolean
          min_order_value?: number | null
          name?: string
          restaurant_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_zones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_instances: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          instance_token: string | null
          instance_uuid: string | null
          is_default: boolean
          last_connected_at: string | null
          phone_number: string | null
          qr_code: string | null
          qr_expires_at: string | null
          reseller_id: string
          restaurant_id: string
          status: string
          updated_at: string
          webhook_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name: string
          instance_token?: string | null
          instance_uuid?: string | null
          is_default?: boolean
          last_connected_at?: string | null
          phone_number?: string | null
          qr_code?: string | null
          qr_expires_at?: string | null
          reseller_id: string
          restaurant_id: string
          status?: string
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          instance_token?: string | null
          instance_uuid?: string | null
          is_default?: boolean
          last_connected_at?: string | null
          phone_number?: string | null
          qr_code?: string | null
          qr_expires_at?: string | null
          reseller_id?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
          webhook_token?: string
        }
        Relationships: []
      }
      fiscal_config: {
        Row: {
          aliquota_cofins: number | null
          aliquota_icms: number | null
          aliquota_pis: number | null
          bairro: string | null
          cep: string | null
          certificado_cipher: string | null
          certificado_expires_at: string | null
          certificado_filename: string | null
          certificado_password_cipher: string | null
          certificado_uploaded_at: string | null
          cnpj: string | null
          codigo_municipio: string | null
          complemento: string | null
          contingency_mode: string
          created_at: string
          csc_id: string | null
          csc_token_cipher: string | null
          default_cest: string | null
          default_cfop: string | null
          default_csosn: string | null
          default_ncm: string | null
          default_origem: string | null
          environment: string
          focus_company_registered: boolean
          ie: string | null
          im: string | null
          is_enabled: boolean
          logradouro: string | null
          municipio: string | null
          nome_fantasia: string | null
          numero: string | null
          proxima_numeracao: number
          razao_social: string | null
          regime_tributario: string | null
          restaurant_id: string
          serie: number
          uf: string | null
          updated_at: string
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_pis?: number | null
          bairro?: string | null
          cep?: string | null
          certificado_cipher?: string | null
          certificado_expires_at?: string | null
          certificado_filename?: string | null
          certificado_password_cipher?: string | null
          certificado_uploaded_at?: string | null
          cnpj?: string | null
          codigo_municipio?: string | null
          complemento?: string | null
          contingency_mode?: string
          created_at?: string
          csc_id?: string | null
          csc_token_cipher?: string | null
          default_cest?: string | null
          default_cfop?: string | null
          default_csosn?: string | null
          default_ncm?: string | null
          default_origem?: string | null
          environment?: string
          focus_company_registered?: boolean
          ie?: string | null
          im?: string | null
          is_enabled?: boolean
          logradouro?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          proxima_numeracao?: number
          razao_social?: string | null
          regime_tributario?: string | null
          restaurant_id: string
          serie?: number
          uf?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_pis?: number | null
          bairro?: string | null
          cep?: string | null
          certificado_cipher?: string | null
          certificado_expires_at?: string | null
          certificado_filename?: string | null
          certificado_password_cipher?: string | null
          certificado_uploaded_at?: string | null
          cnpj?: string | null
          codigo_municipio?: string | null
          complemento?: string | null
          contingency_mode?: string
          created_at?: string
          csc_id?: string | null
          csc_token_cipher?: string | null
          default_cest?: string | null
          default_cfop?: string | null
          default_csosn?: string | null
          default_ncm?: string | null
          default_origem?: string | null
          environment?: string
          focus_company_registered?: boolean
          ie?: string | null
          im?: string | null
          is_enabled?: boolean
          logradouro?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          proxima_numeracao?: number
          razao_social?: string | null
          regime_tributario?: string | null
          restaurant_id?: string
          serie?: number
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_config_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_config_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          invoice_id: string | null
          payload: Json | null
          restaurant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          invoice_id?: string | null
          payload?: Json | null
          restaurant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          invoice_id?: string | null
          payload?: Json | null
          restaurant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_inutilizacoes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          justificativa: string
          numero_final: number
          numero_inicial: number
          protocolo: string | null
          raw_response: Json | null
          reference: string
          rejection_message: string | null
          restaurant_id: string
          serie: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          justificativa: string
          numero_final: number
          numero_inicial: number
          protocolo?: string | null
          raw_response?: Json | null
          reference: string
          rejection_message?: string | null
          restaurant_id: string
          serie: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          justificativa?: string
          numero_final?: number
          numero_inicial?: number
          protocolo?: string | null
          raw_response?: Json | null
          reference?: string
          rejection_message?: string | null
          restaurant_id?: string
          serie?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_inutilizacoes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_inutilizacoes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_invoices: {
        Row: {
          cancellation_reason: string | null
          chave_acesso: string | null
          created_at: string
          created_by: string | null
          customer_cpf: string | null
          customer_name: string | null
          danfe_url: string | null
          data_autorizacao: string | null
          data_cancelamento: string | null
          data_emissao: string | null
          id: string
          numero: number | null
          order_id: number | null
          payment_method: string | null
          protocolo: string | null
          qr_code_url: string | null
          raw_payload: Json | null
          raw_response: Json | null
          reference: string
          rejection_message: string | null
          restaurant_id: string
          serie: number | null
          status: string
          table_order_id: number | null
          type: string
          updated_at: string
          valor_desconto: number | null
          valor_produtos: number | null
          valor_total: number | null
          xml_url: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          chave_acesso?: string | null
          created_at?: string
          created_by?: string | null
          customer_cpf?: string | null
          customer_name?: string | null
          danfe_url?: string | null
          data_autorizacao?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          id?: string
          numero?: number | null
          order_id?: number | null
          payment_method?: string | null
          protocolo?: string | null
          qr_code_url?: string | null
          raw_payload?: Json | null
          raw_response?: Json | null
          reference: string
          rejection_message?: string | null
          restaurant_id: string
          serie?: number | null
          status?: string
          table_order_id?: number | null
          type?: string
          updated_at?: string
          valor_desconto?: number | null
          valor_produtos?: number | null
          valor_total?: number | null
          xml_url?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          chave_acesso?: string | null
          created_at?: string
          created_by?: string | null
          customer_cpf?: string | null
          customer_name?: string | null
          danfe_url?: string | null
          data_autorizacao?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          id?: string
          numero?: number | null
          order_id?: number | null
          payment_method?: string | null
          protocolo?: string | null
          qr_code_url?: string | null
          raw_payload?: Json | null
          raw_response?: Json | null
          reference?: string
          rejection_message?: string | null
          restaurant_id?: string
          serie?: number | null
          status?: string
          table_order_id?: number | null
          type?: string
          updated_at?: string
          valor_desconto?: number | null
          valor_produtos?: number | null
          valor_total?: number | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_table_order_id_fkey"
            columns: ["table_order_id"]
            isOneToOne: false
            referencedRelation: "table_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      global_ai_config: {
        Row: {
          gemini_api_key: string | null
          id: boolean
          openai_api_key: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          gemini_api_key?: string | null
          id?: boolean
          openai_api_key?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          gemini_api_key?: string | null
          id?: boolean
          openai_api_key?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      internal_webhook_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      landing_page_leads: {
        Row: {
          business_name: string | null
          business_type: string | null
          created_at: string | null
          email: string
          id: string
          mp_payment_id: string | null
          mp_payment_status: string | null
          name: string
          notes: string | null
          phone: string | null
          plan_id: string | null
          reseller_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          business_name?: string | null
          business_type?: string | null
          created_at?: string | null
          email: string
          id?: string
          mp_payment_id?: string | null
          mp_payment_status?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          plan_id?: string | null
          reseller_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          business_name?: string | null
          business_type?: string | null
          created_at?: string | null
          email?: string
          id?: string
          mp_payment_id?: string | null
          mp_payment_status?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          plan_id?: string | null
          reseller_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_leads_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_leads_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_leads_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_leads_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          audience: string
          body: string
          created_at: string
          customer_phone: string | null
          data: Json
          event_type: string
          id: string
          order_id: number | null
          read_at: string | null
          restaurant_id: string
          table_order_id: number | null
          title: string
          url: string | null
        }
        Insert: {
          audience: string
          body: string
          created_at?: string
          customer_phone?: string | null
          data?: Json
          event_type: string
          id?: string
          order_id?: number | null
          read_at?: string | null
          restaurant_id: string
          table_order_id?: number | null
          title: string
          url?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          customer_phone?: string | null
          data?: Json
          event_type?: string
          id?: string
          order_id?: number | null
          read_at?: string | null
          restaurant_id?: string
          table_order_id?: number | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_table_order_id_fkey"
            columns: ["table_order_id"]
            isOneToOne: false
            referencedRelation: "table_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          addons_snapshot: Json | null
          created_at: string
          final_quantity_grams: number | null
          final_unit_price: number | null
          id: string
          observation: string | null
          order_id: number | null
          pizza_border: Json | null
          pizza_flavors: Json | null
          product_id: string | null
          product_name: string
          quantity: number
          quantity_grams: number | null
          unit_of_sale: string
          unit_price: number
          weight_status: string
        }
        Insert: {
          addons_snapshot?: Json | null
          created_at?: string
          final_quantity_grams?: number | null
          final_unit_price?: number | null
          id?: string
          observation?: string | null
          order_id?: number | null
          pizza_border?: Json | null
          pizza_flavors?: Json | null
          product_id?: string | null
          product_name: string
          quantity?: number
          quantity_grams?: number | null
          unit_of_sale?: string
          unit_price?: number
          weight_status?: string
        }
        Update: {
          addons_snapshot?: Json | null
          created_at?: string
          final_quantity_grams?: number | null
          final_unit_price?: number | null
          id?: string
          observation?: string | null
          order_id?: number | null
          pizza_border?: Json | null
          pizza_flavors?: Json | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          quantity_grams?: number | null
          unit_of_sale?: string
          unit_price?: number
          weight_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_complement: string | null
          address_neighborhood: string
          address_number: string
          address_reference: string | null
          address_street: string
          agent_nps_scheduled_at: string | null
          assigned_driver_id: string | null
          change_for: number | null
          convenience_fee: number
          conversation_id: string | null
          created_at: string
          created_by_agent_id: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          driver_status: string | null
          id: number
          payment_attempts: number
          payment_method: string
          payment_method_online: string | null
          payment_paid_at: string | null
          payment_pix_expires_at: string | null
          payment_pix_qr_code: string | null
          payment_pix_qr_code_base64: string | null
          payment_provider: string | null
          payment_provider_id: string | null
          payment_status: string | null
          picked_up_at: string | null
          restaurant_id: string | null
          status: string
          stock_deducted_at: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          address_complement?: string | null
          address_neighborhood: string
          address_number: string
          address_reference?: string | null
          address_street: string
          agent_nps_scheduled_at?: string | null
          assigned_driver_id?: string | null
          change_for?: number | null
          convenience_fee?: number
          conversation_id?: string | null
          created_at?: string
          created_by_agent_id?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          driver_status?: string | null
          id?: number
          payment_attempts?: number
          payment_method: string
          payment_method_online?: string | null
          payment_paid_at?: string | null
          payment_pix_expires_at?: string | null
          payment_pix_qr_code?: string | null
          payment_pix_qr_code_base64?: string | null
          payment_provider?: string | null
          payment_provider_id?: string | null
          payment_status?: string | null
          picked_up_at?: string | null
          restaurant_id?: string | null
          status?: string
          stock_deducted_at?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          address_complement?: string | null
          address_neighborhood?: string
          address_number?: string
          address_reference?: string | null
          address_street?: string
          agent_nps_scheduled_at?: string | null
          assigned_driver_id?: string | null
          change_for?: number | null
          convenience_fee?: number
          conversation_id?: string | null
          created_at?: string
          created_by_agent_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          driver_status?: string | null
          id?: number
          payment_attempts?: number
          payment_method?: string
          payment_method_online?: string | null
          payment_paid_at?: string | null
          payment_pix_expires_at?: string | null
          payment_pix_qr_code?: string | null
          payment_pix_qr_code_base64?: string | null
          payment_provider?: string | null
          payment_provider_id?: string | null
          payment_status?: string | null
          picked_up_at?: string | null
          restaurant_id?: string | null
          status?: string
          stock_deducted_at?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_agent_id_fkey"
            columns: ["created_by_agent_id"]
            isOneToOne: false
            referencedRelation: "restaurant_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      org_ai_credentials: {
        Row: {
          api_key_encrypted: string
          created_at: string
          provider: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          api_key_encrypted: string
          created_at?: string
          provider: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string
          created_at?: string
          provider?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_ai_credentials_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_ai_credentials_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      org_ai_routing: {
        Row: {
          capability: string
          created_at: string
          id: string
          is_active: boolean
          model: string
          provider: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          capability?: string
          created_at?: string
          id?: string
          is_active?: boolean
          model?: string
          provider?: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          capability?: string
          created_at?: string
          id?: string
          is_active?: boolean
          model?: string
          provider?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_ai_routing_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_ai_routing_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_border_prices: {
        Row: {
          border_id: string
          price: number
          size_id: string
        }
        Insert: {
          border_id: string
          price?: number
          size_id: string
        }
        Update: {
          border_id?: string
          price?: number
          size_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_border_prices_border_id_fkey"
            columns: ["border_id"]
            isOneToOne: false
            referencedRelation: "pizza_borders_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_border_prices_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "pizza_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_borders_catalog: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_available: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_available?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_borders_catalog_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_borders_catalog_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_flavor_prices: {
        Row: {
          flavor_id: string
          price: number
          size_id: string
        }
        Insert: {
          flavor_id: string
          price?: number
          size_id: string
        }
        Update: {
          flavor_id?: string
          price?: number
          size_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_flavor_prices_flavor_id_fkey"
            columns: ["flavor_id"]
            isOneToOne: false
            referencedRelation: "pizza_flavors_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_flavor_prices_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "pizza_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_flavors_catalog: {
        Row: {
          category: string | null
          created_at: string
          id: string
          image_url: string | null
          ingredients: string | null
          is_available: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_available?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_available?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_flavors_catalog_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_flavors_catalog_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pizza_sizes: {
        Row: {
          base_price: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          max_flavors: number
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          max_flavors?: number
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          max_flavors?: number
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_sizes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pizza_sizes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          id: string
          last_error: string | null
          payload: Json
          printed_at: string | null
          printed_by_station: string | null
          restaurant_id: string
          source: string
          source_id: string | null
          station_role: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          payload: Json
          printed_at?: string | null
          printed_by_station?: string | null
          restaurant_id: string
          source: string
          source_id?: string | null
          station_role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          payload?: Json
          printed_at?: string | null
          printed_by_station?: string | null
          restaurant_id?: string
          source?: string
          source_id?: string | null
          station_role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_printed_by_station_fkey"
            columns: ["printed_by_station"]
            isOneToOne: false
            referencedRelation: "print_stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      print_stations: {
        Row: {
          copies: number
          created_at: string
          device_fingerprint: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          name: string
          paper_width: number
          restaurant_id: string
          role: string
          updated_at: string
        }
        Insert: {
          copies?: number
          created_at?: string
          device_fingerprint: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name: string
          paper_width?: number
          restaurant_id: string
          role?: string
          updated_at?: string
        }
        Update: {
          copies?: number
          created_at?: string
          device_fingerprint?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name?: string
          paper_width?: number
          restaurant_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_stations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_stations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_addon_groups: {
        Row: {
          addon_group_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          addon_group_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          addon_group_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_addon_groups_addon_group_id_fkey"
            columns: ["addon_group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_addon_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipes: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          restaurant_id: string
          stock_item_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          restaurant_id: string
          stock_item_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          restaurant_id?: string
          stock_item_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          agent_pitch: string | null
          allow_weight_variation: boolean
          availability_locked: boolean
          batch_number: string | null
          brand: string | null
          category_id: string | null
          created_at: string
          description: string | null
          expiration_date: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_pizza: boolean
          min_stock_qty: number | null
          name: string
          pizza_borders: Json
          pizza_flavors: Json
          pizza_max_flavors: number
          pizza_pricing_rule: string
          price: number
          price_per_kg: number | null
          promo_enabled: boolean
          promo_ends_at: string | null
          promo_price: number | null
          promo_starts_at: string | null
          requires_prescription: boolean
          restaurant_id: string | null
          stock_qty: number | null
          track_stock: boolean
          unit_of_sale: string
          updated_at: string
        }
        Insert: {
          agent_pitch?: string | null
          allow_weight_variation?: boolean
          availability_locked?: boolean
          batch_number?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          expiration_date?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_pizza?: boolean
          min_stock_qty?: number | null
          name: string
          pizza_borders?: Json
          pizza_flavors?: Json
          pizza_max_flavors?: number
          pizza_pricing_rule?: string
          price?: number
          price_per_kg?: number | null
          promo_enabled?: boolean
          promo_ends_at?: string | null
          promo_price?: number | null
          promo_starts_at?: string | null
          requires_prescription?: boolean
          restaurant_id?: string | null
          stock_qty?: number | null
          track_stock?: boolean
          unit_of_sale?: string
          updated_at?: string
        }
        Update: {
          agent_pitch?: string | null
          allow_weight_variation?: boolean
          availability_locked?: boolean
          batch_number?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          expiration_date?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_pizza?: boolean
          min_stock_qty?: number | null
          name?: string
          pizza_borders?: Json
          pizza_flavors?: Json
          pizza_max_flavors?: number
          pizza_pricing_rule?: string
          price?: number
          price_per_kg?: number | null
          promo_enabled?: boolean
          promo_ends_at?: string | null
          promo_price?: number | null
          promo_starts_at?: string | null
          requires_prescription?: boolean
          restaurant_id?: string | null
          stock_qty?: number | null
          track_stock?: boolean
          unit_of_sale?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          purchase_id: string
          quantity: number
          stock_item_id: string
          total_cost: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          purchase_id: string
          quantity: number
          stock_item_id: string
          total_cost?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          purchase_id?: string
          quantity?: number
          stock_item_id?: string
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          purchase_date: string
          received_at: string | null
          restaurant_id: string
          status: string
          supplier_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          purchase_date?: string
          received_at?: string | null
          restaurant_id: string
          status?: string
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          purchase_date?: string
          received_at?: string | null
          restaurant_id?: string
          status?: string
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          customer_phone: string | null
          endpoint: string
          failure_count: number
          id: string
          last_success_at: string | null
          order_id: number | null
          p256dh: string
          restaurant_id: string
          role: string
          topics: string[]
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          customer_phone?: string | null
          endpoint: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          order_id?: number | null
          p256dh: string
          restaurant_id: string
          role: string
          topics?: string[]
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          customer_phone?: string | null
          endpoint?: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          order_id?: number | null
          p256dh?: string
          restaurant_id?: string
          role?: string
          topics?: string[]
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_evolution_config: {
        Row: {
          created_at: string
          global_api_key: string
          id: string
          is_configured: boolean
          last_tested_at: string | null
          reseller_id: string
          server_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          global_api_key: string
          id?: string
          is_configured?: boolean
          last_tested_at?: string | null
          reseller_id: string
          server_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          global_api_key?: string
          id?: string
          is_configured?: boolean
          last_tested_at?: string | null
          reseller_id?: string
          server_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      resellers: {
        Row: {
          background_color: string | null
          button_text_color: string | null
          company_name: string | null
          created_at: string
          email: string
          foreground_color: string | null
          id: string
          is_active: boolean
          landing_faq: Json | null
          landing_page_email: string | null
          landing_page_enabled: boolean | null
          landing_page_logo: string | null
          landing_page_subtitle: string | null
          landing_page_title: string | null
          landing_page_whatsapp: string | null
          landing_stats: Json | null
          landing_testimonials: Json | null
          mp_access_token: string | null
          mp_integration_enabled: boolean | null
          mp_public_key: string | null
          mp_webhook_secret: string | null
          name: string
          phone: string | null
          primary_color: string | null
          root_domain: string | null
          secondary_color: string | null
          slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          background_color?: string | null
          button_text_color?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          foreground_color?: string | null
          id?: string
          is_active?: boolean
          landing_faq?: Json | null
          landing_page_email?: string | null
          landing_page_enabled?: boolean | null
          landing_page_logo?: string | null
          landing_page_subtitle?: string | null
          landing_page_title?: string | null
          landing_page_whatsapp?: string | null
          landing_stats?: Json | null
          landing_testimonials?: Json | null
          mp_access_token?: string | null
          mp_integration_enabled?: boolean | null
          mp_public_key?: string | null
          mp_webhook_secret?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          root_domain?: string | null
          secondary_color?: string | null
          slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          background_color?: string | null
          button_text_color?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          foreground_color?: string | null
          id?: string
          is_active?: boolean
          landing_faq?: Json | null
          landing_page_email?: string | null
          landing_page_enabled?: boolean | null
          landing_page_logo?: string | null
          landing_page_subtitle?: string | null
          landing_page_title?: string | null
          landing_page_whatsapp?: string | null
          landing_stats?: Json | null
          landing_testimonials?: Json | null
          mp_access_token?: string | null
          mp_integration_enabled?: boolean | null
          mp_public_key?: string | null
          mp_webhook_secret?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          root_domain?: string | null
          secondary_color?: string | null
          slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      restaurant_admins: {
        Row: {
          created_at: string
          id: string
          is_owner: boolean
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_owner?: boolean
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_owner?: boolean
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_admins_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_admins_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_agent_versions: {
        Row: {
          agent_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          restaurant_id: string
          snapshot: Json
        }
        Insert: {
          agent_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          restaurant_id: string
          snapshot: Json
        }
        Update: {
          agent_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          restaurant_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_agent_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "restaurant_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_agent_versions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_agent_versions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_agents: {
        Row: {
          agent_type: string
          allowed_tools: string[]
          auto_notify_status: boolean
          can_close_orders: boolean
          can_do: string[]
          cannot_do: string[]
          created_at: string
          custom_instructions: string | null
          dedicated_instance_id: string | null
          emoji_level: string
          example_conversations: Json
          forbidden_phrases: string[]
          id: string
          is_active: boolean
          is_default: boolean
          knowledge_faq: Json
          max_steps: number
          message_length: string
          model: string
          name: string
          notify_statuses: string[]
          objective: string
          proactive_upsell: boolean
          required_phrases: string[]
          restaurant_id: string
          role: string
          send_photos: boolean
          split_messages: boolean
          system_prompt: string
          temperature: number
          tone: string
          trigger_keywords: string[]
          trigger_phrases: string[]
          typing_delay_ms: number
          updated_at: string
        }
        Insert: {
          agent_type?: string
          allowed_tools?: string[]
          auto_notify_status?: boolean
          can_close_orders?: boolean
          can_do?: string[]
          cannot_do?: string[]
          created_at?: string
          custom_instructions?: string | null
          dedicated_instance_id?: string | null
          emoji_level?: string
          example_conversations?: Json
          forbidden_phrases?: string[]
          id?: string
          is_active?: boolean
          is_default?: boolean
          knowledge_faq?: Json
          max_steps?: number
          message_length?: string
          model?: string
          name: string
          notify_statuses?: string[]
          objective?: string
          proactive_upsell?: boolean
          required_phrases?: string[]
          restaurant_id: string
          role?: string
          send_photos?: boolean
          split_messages?: boolean
          system_prompt: string
          temperature?: number
          tone?: string
          trigger_keywords?: string[]
          trigger_phrases?: string[]
          typing_delay_ms?: number
          updated_at?: string
        }
        Update: {
          agent_type?: string
          allowed_tools?: string[]
          auto_notify_status?: boolean
          can_close_orders?: boolean
          can_do?: string[]
          cannot_do?: string[]
          created_at?: string
          custom_instructions?: string | null
          dedicated_instance_id?: string | null
          emoji_level?: string
          example_conversations?: Json
          forbidden_phrases?: string[]
          id?: string
          is_active?: boolean
          is_default?: boolean
          knowledge_faq?: Json
          max_steps?: number
          message_length?: string
          model?: string
          name?: string
          notify_statuses?: string[]
          objective?: string
          proactive_upsell?: boolean
          required_phrases?: string[]
          restaurant_id?: string
          role?: string
          send_photos?: boolean
          split_messages?: boolean
          system_prompt?: string
          temperature?: number
          tone?: string
          trigger_keywords?: string[]
          trigger_phrases?: string[]
          typing_delay_ms?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_agents_dedicated_instance_id_fkey"
            columns: ["dedicated_instance_id"]
            isOneToOne: false
            referencedRelation: "evolution_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_agents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_agents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_payment_gateways: {
        Row: {
          accepts_credit_card: boolean
          accepts_pix: boolean
          created_at: string
          credentials: Json
          display_name: string | null
          environment: string
          id: string
          is_enabled: boolean
          last_test_at: string | null
          last_test_ok: boolean | null
          provider: string
          public_key: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          accepts_credit_card?: boolean
          accepts_pix?: boolean
          created_at?: string
          credentials?: Json
          display_name?: string | null
          environment?: string
          id?: string
          is_enabled?: boolean
          last_test_at?: string | null
          last_test_ok?: boolean | null
          provider: string
          public_key?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          accepts_credit_card?: boolean
          accepts_pix?: boolean
          created_at?: string
          credentials?: Json
          display_name?: string | null
          environment?: string
          id?: string
          is_enabled?: boolean
          last_test_at?: string | null
          last_test_ok?: boolean | null
          provider?: string
          public_key?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_payment_gateways_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_payment_gateways_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          business_subtype: string | null
          capabilities_override: Json
          contact_email: string | null
          created_at: string
          id: string
          is_active: boolean
          monthly_fee: number
          mp_init_point: string | null
          mp_payer_email: string | null
          mp_subscription_id: string | null
          mp_subscription_status: string | null
          name: string
          owner_name: string | null
          phone: string | null
          plan_id: string | null
          reseller_id: string | null
          setup_fee: number | null
          slug: string
          subscription_end_date: string | null
          subscription_start_date: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_days: number
          updated_at: string
        }
        Insert: {
          business_subtype?: string | null
          capabilities_override?: Json
          contact_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_fee?: number
          mp_init_point?: string | null
          mp_payer_email?: string | null
          mp_subscription_id?: string | null
          mp_subscription_status?: string | null
          name: string
          owner_name?: string | null
          phone?: string | null
          plan_id?: string | null
          reseller_id?: string | null
          setup_fee?: number | null
          slug: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_days?: number
          updated_at?: string
        }
        Update: {
          business_subtype?: string | null
          capabilities_override?: Json
          contact_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_fee?: number
          mp_init_point?: string | null
          mp_payer_email?: string | null
          mp_subscription_id?: string | null
          mp_subscription_status?: string | null
          name?: string
          owner_name?: string | null
          phone?: string | null
          plan_id?: string | null
          reseller_id?: string | null
          setup_fee?: number | null
          slug?: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          average_cost: number
          category: string | null
          created_at: string
          current_qty: number
          id: string
          is_active: boolean
          last_cost: number
          max_qty: number | null
          min_qty: number
          name: string
          notes: string | null
          restaurant_id: string
          sku: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          average_cost?: number
          category?: string | null
          created_at?: string
          current_qty?: number
          id?: string
          is_active?: boolean
          last_cost?: number
          max_qty?: number | null
          min_qty?: number
          name: string
          notes?: string | null
          restaurant_id: string
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          average_cost?: number
          category?: string | null
          created_at?: string
          current_qty?: number
          id?: string
          is_active?: boolean
          last_cost?: number
          max_qty?: number | null
          min_qty?: number
          name?: string
          notes?: string | null
          restaurant_id?: string
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          restaurant_id: string
          stock_item_id: string | null
          total_cost: number
          type: string
          unit_cost: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          restaurant_id: string
          stock_item_id?: string | null
          total_cost?: number
          type: string
          unit_cost?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          restaurant_id?: string
          stock_item_id?: string | null
          total_cost?: number
          type?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      store_config: {
        Row: {
          accent_color: string | null
          address: string | null
          auto_print_delivery: boolean
          auto_print_enabled: boolean
          auto_print_quick_sale: boolean
          auto_print_table: boolean
          background_color: string | null
          business_subtype: string | null
          business_type: string
          button_text_color: string | null
          capabilities_override: Json
          cover_url: string | null
          created_at: string
          delivery_fee: number
          delivery_fee_mode: string | null
          delivery_time_max: number | null
          delivery_time_min: number | null
          driver_assignment_mode: string
          driver_auto_timeout_seconds: number
          driver_customer_rating_enabled: boolean
          driver_default_commission: number
          driver_max_radius_km: number
          driver_public_tracking_enabled: boolean
          foreground_color: string | null
          google_ads_conversion_label_purchase: string | null
          google_ads_id: string | null
          google_analytics_id: string | null
          id: string
          is_open: boolean
          kitchen_pin: string | null
          kitchen_pin_enabled: boolean | null
          logo_url: string | null
          menu_labels: Json
          meta_capi_token: string | null
          meta_pixel_id: string | null
          meta_test_event_code: string | null
          min_order_value: number
          msg_order_accepted: string | null
          msg_order_completed: string | null
          msg_order_delivery: string | null
          msg_order_preparing: string | null
          name: string
          phone_whatsapp: string | null
          pix_key: string | null
          pix_key_type: string | null
          pix_message: string | null
          primary_color: string | null
          print_default_copies: number
          print_default_paper_width: number
          print_split_by_department: boolean
          pwa_name: string | null
          pwa_short_name: string | null
          restaurant_id: string | null
          secondary_color: string | null
          setup_seeded: boolean
          timezone: string | null
          tracking_enabled: boolean
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          auto_print_delivery?: boolean
          auto_print_enabled?: boolean
          auto_print_quick_sale?: boolean
          auto_print_table?: boolean
          background_color?: string | null
          business_subtype?: string | null
          business_type?: string
          button_text_color?: string | null
          capabilities_override?: Json
          cover_url?: string | null
          created_at?: string
          delivery_fee?: number
          delivery_fee_mode?: string | null
          delivery_time_max?: number | null
          delivery_time_min?: number | null
          driver_assignment_mode?: string
          driver_auto_timeout_seconds?: number
          driver_customer_rating_enabled?: boolean
          driver_default_commission?: number
          driver_max_radius_km?: number
          driver_public_tracking_enabled?: boolean
          foreground_color?: string | null
          google_ads_conversion_label_purchase?: string | null
          google_ads_id?: string | null
          google_analytics_id?: string | null
          id?: string
          is_open?: boolean
          kitchen_pin?: string | null
          kitchen_pin_enabled?: boolean | null
          logo_url?: string | null
          menu_labels?: Json
          meta_capi_token?: string | null
          meta_pixel_id?: string | null
          meta_test_event_code?: string | null
          min_order_value?: number
          msg_order_accepted?: string | null
          msg_order_completed?: string | null
          msg_order_delivery?: string | null
          msg_order_preparing?: string | null
          name?: string
          phone_whatsapp?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_message?: string | null
          primary_color?: string | null
          print_default_copies?: number
          print_default_paper_width?: number
          print_split_by_department?: boolean
          pwa_name?: string | null
          pwa_short_name?: string | null
          restaurant_id?: string | null
          secondary_color?: string | null
          setup_seeded?: boolean
          timezone?: string | null
          tracking_enabled?: boolean
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          auto_print_delivery?: boolean
          auto_print_enabled?: boolean
          auto_print_quick_sale?: boolean
          auto_print_table?: boolean
          background_color?: string | null
          business_subtype?: string | null
          business_type?: string
          button_text_color?: string | null
          capabilities_override?: Json
          cover_url?: string | null
          created_at?: string
          delivery_fee?: number
          delivery_fee_mode?: string | null
          delivery_time_max?: number | null
          delivery_time_min?: number | null
          driver_assignment_mode?: string
          driver_auto_timeout_seconds?: number
          driver_customer_rating_enabled?: boolean
          driver_default_commission?: number
          driver_max_radius_km?: number
          driver_public_tracking_enabled?: boolean
          foreground_color?: string | null
          google_ads_conversion_label_purchase?: string | null
          google_ads_id?: string | null
          google_analytics_id?: string | null
          id?: string
          is_open?: boolean
          kitchen_pin?: string | null
          kitchen_pin_enabled?: boolean | null
          logo_url?: string | null
          menu_labels?: Json
          meta_capi_token?: string | null
          meta_pixel_id?: string | null
          meta_test_event_code?: string | null
          min_order_value?: number
          msg_order_accepted?: string | null
          msg_order_completed?: string | null
          msg_order_delivery?: string | null
          msg_order_preparing?: string | null
          name?: string
          phone_whatsapp?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          pix_message?: string | null
          primary_color?: string | null
          print_default_copies?: number
          print_default_paper_width?: number
          print_split_by_department?: boolean
          pwa_name?: string | null
          pwa_short_name?: string | null
          restaurant_id?: string | null
          secondary_color?: string | null
          setup_seeded?: boolean
          timezone?: string | null
          tracking_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_config_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_config_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          mp_external_reference: string | null
          mp_payment_id: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          mp_external_reference?: string | null
          mp_payment_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          mp_external_reference?: string | null
          mp_payment_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          ai_image_enhancements_per_month: number
          convenience_fee_description: string
          convenience_fee_fixed: number
          convenience_fee_label: string
          convenience_fee_percent: number
          convenience_fee_type: string
          created_at: string
          description: string | null
          enabled_features: string[]
          features: string[] | null
          id: string
          is_active: boolean
          is_popular: boolean | null
          monthly_fee: number
          name: string
          reseller_id: string
          setup_fee: number | null
          sort_order: number
          trial_days: number
          updated_at: string
          wa_instances_limit: number
        }
        Insert: {
          ai_image_enhancements_per_month?: number
          convenience_fee_description?: string
          convenience_fee_fixed?: number
          convenience_fee_label?: string
          convenience_fee_percent?: number
          convenience_fee_type?: string
          created_at?: string
          description?: string | null
          enabled_features?: string[]
          features?: string[] | null
          id?: string
          is_active?: boolean
          is_popular?: boolean | null
          monthly_fee?: number
          name: string
          reseller_id: string
          setup_fee?: number | null
          sort_order?: number
          trial_days?: number
          updated_at?: string
          wa_instances_limit?: number
        }
        Update: {
          ai_image_enhancements_per_month?: number
          convenience_fee_description?: string
          convenience_fee_fixed?: number
          convenience_fee_label?: string
          convenience_fee_percent?: number
          convenience_fee_type?: string
          created_at?: string
          description?: string | null
          enabled_features?: string[]
          features?: string[] | null
          id?: string
          is_active?: boolean
          is_popular?: boolean | null
          monthly_fee?: number
          name?: string
          reseller_id?: string
          setup_fee?: number | null
          sort_order?: number
          trial_days?: number
          updated_at?: string
          wa_instances_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plans_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plans_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_name: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      table_order_items: {
        Row: {
          addons_snapshot: Json | null
          created_at: string | null
          delivered_at: string | null
          id: string
          observation: string | null
          ordered_at: string | null
          pizza_border: Json | null
          pizza_flavors: Json | null
          product_id: string | null
          product_name: string
          quantity: number
          status: string | null
          table_order_id: number | null
          unit_price: number
        }
        Insert: {
          addons_snapshot?: Json | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          observation?: string | null
          ordered_at?: string | null
          pizza_border?: Json | null
          pizza_flavors?: Json | null
          product_id?: string | null
          product_name: string
          quantity?: number
          status?: string | null
          table_order_id?: number | null
          unit_price: number
        }
        Update: {
          addons_snapshot?: Json | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          observation?: string | null
          ordered_at?: string | null
          pizza_border?: Json | null
          pizza_flavors?: Json | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          status?: string | null
          table_order_id?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "table_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_order_items_table_order_id_fkey"
            columns: ["table_order_id"]
            isOneToOne: false
            referencedRelation: "table_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      table_orders: {
        Row: {
          closed_at: string | null
          created_at: string | null
          customer_count: number | null
          discount: number | null
          discount_type: string | null
          id: number
          notes: string | null
          opened_at: string | null
          payment_method: string | null
          restaurant_id: string | null
          service_fee_enabled: boolean | null
          service_fee_percentage: number | null
          status: string | null
          stock_deducted_at: string | null
          subtotal: number | null
          table_id: string | null
          total_amount: number | null
          updated_at: string | null
          waiter_id: string | null
          waiter_name: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          customer_count?: number | null
          discount?: number | null
          discount_type?: string | null
          id?: never
          notes?: string | null
          opened_at?: string | null
          payment_method?: string | null
          restaurant_id?: string | null
          service_fee_enabled?: boolean | null
          service_fee_percentage?: number | null
          status?: string | null
          stock_deducted_at?: string | null
          subtotal?: number | null
          table_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          waiter_id?: string | null
          waiter_name?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          customer_count?: number | null
          discount?: number | null
          discount_type?: string | null
          id?: never
          notes?: string | null
          opened_at?: string | null
          payment_method?: string | null
          restaurant_id?: string | null
          service_fee_enabled?: boolean | null
          service_fee_percentage?: number | null
          status?: string | null
          stock_deducted_at?: string | null
          subtotal?: number | null
          table_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          waiter_id?: string | null
          waiter_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_orders_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          capacity: number | null
          created_at: string | null
          current_order_id: number | null
          id: string
          name: string | null
          number: number
          restaurant_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          current_order_id?: number | null
          id?: string
          name?: string | null
          number: number
          restaurant_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          current_order_id?: number | null
          id?: string
          name?: string | null
          number?: number
          restaurant_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tables_current_order_id_fkey"
            columns: ["current_order_id"]
            isOneToOne: false
            referencedRelation: "table_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      unknown_address_requests: {
        Row: {
          agent_id: string | null
          conversation_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          neighborhood: string | null
          note: string | null
          raw_address: string
          restaurant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          conversation_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          neighborhood?: string | null
          note?: string | null
          raw_address: string
          restaurant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          conversation_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          neighborhood?: string | null
          note?: string | null
          raw_address?: string
          restaurant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unknown_address_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unknown_address_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wa_contacts: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          linked_customer_phone: string | null
          name: string | null
          phone_e164: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          linked_customer_phone?: string | null
          name?: string | null
          phone_e164: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          linked_customer_phone?: string | null
          name?: string | null
          phone_e164?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      wa_conversations: {
        Row: {
          ai_agent_id: string | null
          ai_enabled: boolean
          assigned_user_id: string | null
          contact_id: string
          created_at: string
          id: string
          instance_id: string
          last_message_at: string | null
          last_message_preview: string | null
          restaurant_id: string
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          ai_agent_id?: string | null
          ai_enabled?: boolean
          assigned_user_id?: string | null
          contact_id: string
          created_at?: string
          id?: string
          instance_id: string
          last_message_at?: string | null
          last_message_preview?: string | null
          restaurant_id: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          ai_agent_id?: string | null
          ai_enabled?: boolean
          assigned_user_id?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          instance_id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          restaurant_id?: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      wa_messages: {
        Row: {
          content_type: string
          conversation_id: string
          created_at: string
          direction: string
          from_me: boolean
          id: string
          media_filename: string | null
          media_mime: string | null
          media_url: string | null
          reply_to_id: string | null
          restaurant_id: string
          sender_user_id: string | null
          sent_at: string | null
          status: string
          text: string | null
          wa_message_id: string | null
        }
        Insert: {
          content_type?: string
          conversation_id: string
          created_at?: string
          direction: string
          from_me?: boolean
          id?: string
          media_filename?: string | null
          media_mime?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          restaurant_id: string
          sender_user_id?: string | null
          sent_at?: string | null
          status?: string
          text?: string | null
          wa_message_id?: string | null
        }
        Update: {
          content_type?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          from_me?: boolean
          id?: string
          media_filename?: string | null
          media_mime?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          restaurant_id?: string
          sender_user_id?: string | null
          sent_at?: string | null
          status?: string
          text?: string | null
          wa_message_id?: string | null
        }
        Relationships: []
      }
      wa_quick_replies: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          restaurant_id: string
          shortcut: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          restaurant_id: string
          shortcut: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          restaurant_id?: string
          shortcut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_quick_replies_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_quick_replies_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      waiters: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          pin: string | null
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          pin?: string | null
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          pin?: string | null
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiters_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiters_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      orders_tracking: {
        Row: {
          created_at: string | null
          id: number | null
          payment_method: string | null
          restaurant_id: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number | null
          payment_method?: string | null
          restaurant_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number | null
          payment_method?: string | null
          restaurant_id?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_evolution_config_safe: {
        Row: {
          created_at: string | null
          global_api_key_masked: string | null
          has_api_key: boolean | null
          id: string | null
          is_configured: boolean | null
          last_tested_at: string | null
          reseller_id: string | null
          server_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          global_api_key_masked?: never
          has_api_key?: never
          id?: string | null
          is_configured?: boolean | null
          last_tested_at?: string | null
          reseller_id?: string | null
          server_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          global_api_key_masked?: never
          has_api_key?: never
          id?: string | null
          is_configured?: boolean | null
          last_tested_at?: string | null
          reseller_id?: string | null
          server_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      resellers_public: {
        Row: {
          company_name: string | null
          id: string | null
          is_active: boolean | null
          landing_faq: Json | null
          landing_page_enabled: boolean | null
          landing_page_logo: string | null
          landing_page_subtitle: string | null
          landing_page_title: string | null
          landing_stats: Json | null
          landing_testimonials: Json | null
          primary_color: string | null
          secondary_color: string | null
          slug: string | null
        }
        Insert: {
          company_name?: string | null
          id?: string | null
          is_active?: boolean | null
          landing_faq?: Json | null
          landing_page_enabled?: boolean | null
          landing_page_logo?: string | null
          landing_page_subtitle?: string | null
          landing_page_title?: string | null
          landing_stats?: Json | null
          landing_testimonials?: Json | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string | null
        }
        Update: {
          company_name?: string | null
          id?: string | null
          is_active?: boolean | null
          landing_faq?: Json | null
          landing_page_enabled?: boolean | null
          landing_page_logo?: string | null
          landing_page_subtitle?: string | null
          landing_page_title?: string | null
          landing_stats?: Json | null
          landing_testimonials?: Json | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      resellers_safe: {
        Row: {
          company_name: string | null
          created_at: string | null
          email: string | null
          id: string | null
          is_active: boolean | null
          landing_faq: Json | null
          landing_page_email: string | null
          landing_page_enabled: boolean | null
          landing_page_logo: string | null
          landing_page_subtitle: string | null
          landing_page_title: string | null
          landing_page_whatsapp: string | null
          landing_stats: Json | null
          landing_testimonials: Json | null
          mp_integration_enabled: boolean | null
          name: string | null
          phone: string | null
          primary_color: string | null
          root_domain: string | null
          secondary_color: string | null
          slug: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          is_active?: boolean | null
          landing_faq?: Json | null
          landing_page_email?: string | null
          landing_page_enabled?: boolean | null
          landing_page_logo?: string | null
          landing_page_subtitle?: string | null
          landing_page_title?: string | null
          landing_page_whatsapp?: string | null
          landing_stats?: Json | null
          landing_testimonials?: Json | null
          mp_integration_enabled?: boolean | null
          name?: string | null
          phone?: string | null
          primary_color?: string | null
          root_domain?: string | null
          secondary_color?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          is_active?: boolean | null
          landing_faq?: Json | null
          landing_page_email?: string | null
          landing_page_enabled?: boolean | null
          landing_page_logo?: string | null
          landing_page_subtitle?: string | null
          landing_page_title?: string | null
          landing_page_whatsapp?: string | null
          landing_stats?: Json | null
          landing_testimonials?: Json | null
          mp_integration_enabled?: boolean | null
          name?: string | null
          phone?: string | null
          primary_color?: string | null
          root_domain?: string | null
          secondary_color?: string | null
          slug?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      restaurants_public: {
        Row: {
          id: string | null
          is_active: boolean | null
          name: string | null
          slug: string | null
        }
        Insert: {
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          slug?: string | null
        }
        Update: {
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      store_config_public: {
        Row: {
          accent_color: string | null
          address: string | null
          cover_url: string | null
          created_at: string | null
          delivery_fee: number | null
          delivery_fee_mode: string | null
          delivery_time_max: number | null
          delivery_time_min: number | null
          id: string | null
          is_open: boolean | null
          logo_url: string | null
          min_order_value: number | null
          msg_order_accepted: string | null
          msg_order_completed: string | null
          msg_order_delivery: string | null
          msg_order_preparing: string | null
          name: string | null
          primary_color: string | null
          pwa_name: string | null
          pwa_short_name: string | null
          restaurant_id: string | null
          secondary_color: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          cover_url?: string | null
          created_at?: string | null
          delivery_fee?: number | null
          delivery_fee_mode?: string | null
          delivery_time_max?: number | null
          delivery_time_min?: number | null
          id?: string | null
          is_open?: boolean | null
          logo_url?: string | null
          min_order_value?: number | null
          msg_order_accepted?: string | null
          msg_order_completed?: string | null
          msg_order_delivery?: string | null
          msg_order_preparing?: string | null
          name?: string | null
          primary_color?: string | null
          pwa_name?: string | null
          pwa_short_name?: string | null
          restaurant_id?: string | null
          secondary_color?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          cover_url?: string | null
          created_at?: string | null
          delivery_fee?: number | null
          delivery_fee_mode?: string | null
          delivery_time_max?: number | null
          delivery_time_min?: number | null
          id?: string | null
          is_open?: boolean | null
          logo_url?: string | null
          min_order_value?: number | null
          msg_order_accepted?: string | null
          msg_order_completed?: string | null
          msg_order_delivery?: string | null
          msg_order_preparing?: string | null
          name?: string | null
          primary_color?: string | null
          pwa_name?: string | null
          pwa_short_name?: string | null
          restaurant_id?: string | null
          secondary_color?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_config_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_config_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_order_item_weight: {
        Args: { p_final_grams: number; p_item_id: string }
        Returns: undefined
      }
      apply_items_stock_deduction: {
        Args: {
          p_items: Json
          p_reference_id: string
          p_reference_type: string
          p_restaurant_id: string
        }
        Returns: undefined
      }
      assign_driver_to_order: {
        Args: { p_driver_id: string; p_order_id: number }
        Returns: undefined
      }
      claim_due_bot_debounce: {
        Args: { p_limit?: number }
        Returns: {
          conversation_id: string
          fire_at: string
          restaurant_id: string
        }[]
      }
      claim_due_outreach: {
        Args: { p_limit?: number }
        Returns: {
          agent_id: string
          contact_id: string
          conversation_id: string
          extra_context: string
          id: string
          objective: string
          restaurant_id: string
        }[]
      }
      claim_print_job: {
        Args: { p_job_id: string; p_station_id: string }
        Returns: boolean
      }
      close_driver_shift: {
        Args: { p_notes?: string; p_shift_id: string }
        Returns: undefined
      }
      convert_stock_qty: {
        Args: { p_from: string; p_qty: number; p_to: string }
        Returns: number
      }
      create_customer_order:
        | {
            Args: {
              p_address_complement: string
              p_address_neighborhood: string
              p_address_number: string
              p_address_reference: string
              p_address_street: string
              p_change_for: number
              p_customer_name: string
              p_customer_phone: string
              p_items: Json
              p_payment_method: string
              p_restaurant_id: string
              p_total_amount: number
            }
            Returns: number
          }
        | {
            Args: {
              p_address_complement: string
              p_address_neighborhood: string
              p_address_number: string
              p_address_reference: string
              p_address_street: string
              p_change_for: number
              p_convenience_fee?: number
              p_customer_name: string
              p_customer_phone: string
              p_items: Json
              p_payment_method: string
              p_restaurant_id: string
              p_total_amount: number
            }
            Returns: number
          }
      decrypt_ai_credential: {
        Args: { p_cipher: string; p_key: string }
        Returns: string
      }
      driver_action_order: {
        Args: {
          p_action: string
          p_driver_id: string
          p_order_id: number
          p_pin: string
        }
        Returns: undefined
      }
      driver_close_shift: {
        Args: { p_driver_id: string; p_pin: string }
        Returns: undefined
      }
      driver_open_shift: {
        Args: { p_driver_id: string; p_pin: string }
        Returns: string
      }
      driver_update_location: {
        Args: {
          p_accuracy?: number
          p_driver_id: string
          p_heading?: number
          p_lat: number
          p_lng: number
          p_pin: string
          p_speed?: number
        }
        Returns: undefined
      }
      encrypt_ai_credential: {
        Args: { p_key: string; p_plain: string }
        Returns: string
      }
      expire_pending_driver_offers: { Args: never; Returns: number }
      get_active_waiters: {
        Args: { p_restaurant_id: string }
        Returns: {
          has_pin: boolean
          id: string
          name: string
        }[]
      }
      get_ai_enhancement_quota: {
        Args: { p_restaurant_id: string }
        Returns: {
          quota: number
          remaining: number
          used: number
        }[]
      }
      get_cash_session_summary: {
        Args: { p_session_id: string }
        Returns: Json
      }
      get_customer_addresses: {
        Args: { p_phone: string; p_restaurant_id: string }
        Returns: {
          complement: string
          created_at: string
          customer_phone: string
          id: string
          is_default: boolean
          label: string
          neighborhood: string
          number: string
          reference: string
          restaurant_id: string
          street: string
        }[]
      }
      get_default_public_reseller: {
        Args: never
        Returns: {
          company_name: string
          id: string
          landing_faq: Json
          landing_page_enabled: boolean
          landing_page_logo: string
          landing_page_subtitle: string
          landing_page_title: string
          landing_stats: Json
          landing_testimonials: Json
          primary_color: string
          secondary_color: string
          slug: string
        }[]
      }
      get_driver_orders: {
        Args: { p_driver_id: string; p_pin: string }
        Returns: {
          address_complement: string
          address_neighborhood: string
          address_number: string
          address_reference: string
          address_street: string
          change_for: number
          created_at: string
          customer_name: string
          customer_phone: string
          driver_status: string
          id: number
          payment_method: string
          status: string
          total_amount: number
        }[]
      }
      get_driver_settings: {
        Args: { p_restaurant_id: string }
        Returns: {
          driver_assignment_mode: string
          driver_auto_timeout_seconds: number
          driver_customer_rating_enabled: boolean
          driver_default_commission: number
          driver_max_radius_km: number
          driver_public_tracking_enabled: boolean
        }[]
      }
      get_driver_shifts_report: {
        Args: { p_end?: string; p_restaurant_id: string; p_start?: string }
        Returns: {
          avg_rating: number
          driver_id: string
          driver_name: string
          shifts_count: number
          total_commission: number
          total_deliveries: number
          total_hours: number
        }[]
      }
      get_drivers_with_location: {
        Args: { p_restaurant_id: string }
        Returns: {
          id: string
          lat: number
          lng: number
          name: string
          phone: string
          photo_url: string
          status: string
          updated_at: string
          vehicle_type: string
        }[]
      }
      get_has_any_reseller: { Args: never; Returns: boolean }
      get_kitchen_table_items: {
        Args: { p_restaurant_id: string; p_statuses?: string[] }
        Returns: {
          addons_snapshot: Json | null
          created_at: string | null
          delivered_at: string | null
          id: string
          observation: string | null
          ordered_at: string | null
          pizza_border: Json | null
          pizza_flavors: Json | null
          product_id: string | null
          product_name: string
          quantity: number
          status: string | null
          table_order_id: number | null
          unit_price: number
        }[]
        SetofOptions: {
          from: "*"
          to: "table_order_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_low_stock_items: {
        Args: { p_restaurant_id: string }
        Returns: {
          current_qty: number
          id: string
          min_qty: number
          name: string
          unit: string
        }[]
      }
      get_open_cash_session: {
        Args: { p_restaurant_id: string }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          closing_notes: string | null
          counted_amounts: Json | null
          created_at: string
          difference: number | null
          expected_amounts: Json | null
          id: string
          opened_at: string
          opened_by: string
          opening_amount: number
          opening_notes: string | null
          restaurant_id: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "cash_sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_open_table_orders: {
        Args: { p_restaurant_id: string }
        Returns: {
          closed_at: string | null
          created_at: string | null
          customer_count: number | null
          discount: number | null
          discount_type: string | null
          id: number
          notes: string | null
          opened_at: string | null
          payment_method: string | null
          restaurant_id: string | null
          service_fee_enabled: boolean | null
          service_fee_percentage: number | null
          status: string | null
          stock_deducted_at: string | null
          subtotal: number | null
          table_id: string | null
          total_amount: number | null
          updated_at: string | null
          waiter_id: string | null
          waiter_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "table_orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_order_payment_status: {
        Args: { p_order_id: number }
        Returns: {
          id: number
          payment_method_online: string
          payment_pix_expires_at: string
          payment_pix_qr_code: string
          payment_pix_qr_code_base64: string
          payment_provider: string
          payment_status: string
          restaurant_id: string
          status: string
          total_amount: number
        }[]
      }
      get_public_driver_tracking: {
        Args: { p_customer_phone: string; p_order_id: number }
        Returns: {
          driver_lat: number
          driver_lng: number
          driver_name: string
          driver_phone: string
          driver_photo: string
          driver_status: string
          location_updated_at: string
          order_status: string
          vehicle_type: string
        }[]
      }
      get_public_reseller_by_slug: {
        Args: { p_slug: string }
        Returns: {
          company_name: string
          id: string
          landing_faq: Json
          landing_page_enabled: boolean
          landing_page_logo: string
          landing_page_subtitle: string
          landing_page_title: string
          landing_stats: Json
          landing_testimonials: Json
          primary_color: string
          secondary_color: string
          slug: string
        }[]
      }
      get_public_store_config: {
        Args: { p_restaurant_id: string }
        Returns: {
          accent_color: string
          address: string
          background_color: string
          business_type: string
          button_text_color: string
          cover_url: string
          delivery_fee: number
          delivery_fee_mode: string
          delivery_time_max: number
          delivery_time_min: number
          foreground_color: string
          google_ads_conversion_label_purchase: string
          google_ads_id: string
          google_analytics_id: string
          id: string
          is_open: boolean
          logo_url: string
          menu_labels: Json
          meta_pixel_id: string
          min_order_value: number
          msg_order_accepted: string
          msg_order_completed: string
          msg_order_delivery: string
          msg_order_preparing: string
          name: string
          phone_whatsapp: string
          primary_color: string
          pwa_name: string
          pwa_short_name: string
          restaurant_id: string
          secondary_color: string
          timezone: string
          tracking_enabled: boolean
        }[]
      }
      get_restaurant_convenience_fee: {
        Args: { p_restaurant_id: string; p_subtotal?: number }
        Returns: {
          description: string
          fee_amount: number
          fee_fixed: number
          fee_percent: number
          fee_type: string
          label: string
        }[]
      }
      get_restaurant_id_by_slug: { Args: { p_slug: string }; Returns: string }
      get_restaurant_id_from_table: {
        Args: { _table_id: string }
        Returns: string
      }
      get_restaurant_payment_methods: {
        Args: { p_restaurant_id: string }
        Returns: {
          accepts_credit_card: boolean
          accepts_pix: boolean
          environment: string
          provider: string
          public_key: string
        }[]
      }
      get_table_order_by_id: {
        Args: { p_order_id: number }
        Returns: {
          closed_at: string | null
          created_at: string | null
          customer_count: number | null
          discount: number | null
          discount_type: string | null
          id: number
          notes: string | null
          opened_at: string | null
          payment_method: string | null
          restaurant_id: string | null
          service_fee_enabled: boolean | null
          service_fee_percentage: number | null
          status: string | null
          stock_deducted_at: string | null
          subtotal: number | null
          table_id: string | null
          total_amount: number | null
          updated_at: string | null
          waiter_id: string | null
          waiter_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "table_orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_table_order_items_batch: {
        Args: { p_order_ids: number[]; p_restaurant_id: string }
        Returns: {
          addons_snapshot: Json | null
          created_at: string | null
          delivered_at: string | null
          id: string
          observation: string | null
          ordered_at: string | null
          pizza_border: Json | null
          pizza_flavors: Json | null
          product_id: string | null
          product_name: string
          quantity: number
          status: string | null
          table_order_id: number | null
          unit_price: number
        }[]
        SetofOptions: {
          from: "*"
          to: "table_order_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_table_order_items_by_order: {
        Args: { p_order_id: number }
        Returns: {
          addons_snapshot: Json | null
          created_at: string | null
          delivered_at: string | null
          id: string
          observation: string | null
          ordered_at: string | null
          pizza_border: Json | null
          pizza_flavors: Json | null
          product_id: string | null
          product_name: string
          quantity: number
          status: string | null
          table_order_id: number | null
          unit_price: number
        }[]
        SetofOptions: {
          from: "*"
          to: "table_order_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_reseller_id: { Args: { _user_id: string }; Returns: string }
      get_user_restaurant_id: { Args: { _user_id: string }; Returns: string }
      has_fiscal_enabled: { Args: { _restaurant_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_of_restaurant: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      is_admin_of_table_order: {
        Args: { _table_order_id: number; _user_id: string }
        Returns: boolean
      }
      is_reseller: { Args: { _user_id: string }; Returns: boolean }
      is_reseller_of_restaurant: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      is_restaurant_admin: { Args: { _user_id: string }; Returns: boolean }
      list_active_drivers: {
        Args: { p_restaurant_id: string }
        Returns: {
          id: string
          name: string
          phone: string
          photo_url: string
          status: string
          vehicle_type: string
        }[]
      }
      list_customer_notifications: {
        Args: { p_customer_phone: string; p_order_id: number }
        Returns: {
          audience: string
          body: string
          created_at: string
          customer_phone: string | null
          data: Json
          event_type: string
          id: string
          order_id: number | null
          read_at: string | null
          restaurant_id: string
          table_order_id: number | null
          title: string
          url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mark_customer_notification_read: {
        Args: {
          p_customer_phone: string
          p_notification_id: string
          p_order_id: number
        }
        Returns: undefined
      }
      mark_customer_notifications_all_read: {
        Args: { p_customer_phone: string; p_order_id: number }
        Returns: undefined
      }
      match_agent_knowledge: {
        Args: {
          p_match_count?: number
          p_query_embedding: string
          p_restaurant_id: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          source_label: string
          source_type: string
        }[]
      }
      receive_purchase: { Args: { p_purchase_id: string }; Returns: undefined }
      refresh_product_availability: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      register_stock_movement: {
        Args: {
          p_notes?: string
          p_quantity: number
          p_stock_item_id: string
          p_type: string
          p_unit_cost?: number
        }
        Returns: string
      }
      save_customer_push_subscription: {
        Args: {
          p_auth: string
          p_customer_phone: string
          p_endpoint: string
          p_order_id: number
          p_p256dh: string
          p_topics?: string[]
          p_user_agent?: string
        }
        Returns: string
      }
      search_customer_orders: {
        Args: { p_phone_digits: string; p_restaurant_id: string }
        Returns: {
          address_neighborhood: string
          address_number: string
          address_street: string
          created_at: string
          customer_name: string
          customer_phone: string
          id: number
          payment_method: string
          status: string
          total_amount: number
        }[]
      }
      submit_delivery_rating: {
        Args: {
          p_comment?: string
          p_customer_phone: string
          p_order_id: number
          p_stars: number
        }
        Returns: undefined
      }
      suggest_nearest_driver: {
        Args: { p_order_id: number }
        Returns: {
          distance_km: number
          driver_id: string
          driver_name: string
          last_seen: string
          status: string
        }[]
      }
      update_driver_settings: {
        Args: {
          p_commission: number
          p_customer_rating: boolean
          p_mode: string
          p_public_tracking: boolean
          p_radius: number
          p_restaurant_id: string
          p_timeout: number
        }
        Returns: undefined
      }
      validate_coupon_lookup: {
        Args: { p_code: string; p_order_total: number; p_restaurant_id: string }
        Returns: {
          code: string
          current_uses: number
          discount_type: string
          discount_value: number
          expires_at: string
          id: string
          is_active: boolean
          max_uses: number
          min_order_value: number
          restaurant_id: string
        }[]
      }
      validate_driver_pin: {
        Args: { p_pin: string; p_restaurant_id: string }
        Returns: {
          driver_id: string
          driver_name: string
          photo_url: string
          vehicle_type: string
        }[]
      }
      validate_kitchen_pin: {
        Args: { p_pin: string; p_restaurant_id: string }
        Returns: boolean
      }
      validate_waiter_pin: {
        Args: { p_pin: string; p_restaurant_id: string }
        Returns: {
          waiter_id: string
          waiter_name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "reseller"
      payment_status: "pending" | "paid" | "overdue" | "cancelled"
      subscription_status: "trial" | "active" | "suspended" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "reseller"],
      payment_status: ["pending", "paid", "overdue", "cancelled"],
      subscription_status: ["trial", "active", "suspended", "cancelled"],
    },
  },
} as const
