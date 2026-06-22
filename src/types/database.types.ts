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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          module: string
          new_value: Json | null
          notes: string | null
          previous_value: Json | null
          region_id: string | null
          role_at_time: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          action: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          module: string
          new_value?: Json | null
          notes?: string | null
          previous_value?: Json | null
          region_id?: string | null
          role_at_time: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          module?: string
          new_value?: Json | null
          notes?: string | null
          previous_value?: Json | null
          region_id?: string | null
          role_at_time?: string
          timestamp?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_offerings: {
        Row: {
          id: string
          dispatch_cycle_id: string
          product_id: string
          expected_quantity: number
          sale_price: number
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dispatch_cycle_id: string
          product_id: string
          expected_quantity: number
          sale_price: number
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dispatch_cycle_id?: string
          product_id?: string
          expected_quantity?: number
          sale_price?: number
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_offerings_dispatch_cycle_id_fkey"
            columns: ["dispatch_cycle_id"]
            isOneToOne: false
            referencedRelation: "dispatch_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_offerings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          claimed_quantity: number
          created_at: string
          customer_id: string
          id: string
          is_justified: boolean | null
          order_id: string
          photo_url: string
          product_id: string
          reason: string
          resolution_amount: number | null
          resolution_type: string | null
          resolution_proof_url: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          claimed_quantity: number
          created_at?: string
          customer_id: string
          id?: string
          is_justified?: boolean | null
          order_id: string
          photo_url: string
          product_id: string
          reason: string
          resolution_amount?: number | null
          resolution_type?: string | null
          resolution_proof_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          claimed_quantity?: number
          created_at?: string
          customer_id?: string
          id?: string
          is_justified?: boolean | null
          order_id?: string
          photo_url?: string
          product_id?: string
          reason?: string
          resolution_amount?: number | null
          resolution_type?: string | null
          resolution_proof_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_routes: {
        Row: {
          completed_at: string | null
          created_at: string
          delivery_person_id: string
          dispatch_cycle_id: string
          id: string
          optimized_route_url: string | null
          region_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          delivery_person_id: string
          dispatch_cycle_id: string
          id?: string
          optimized_route_url?: string | null
          region_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          delivery_person_id?: string
          dispatch_cycle_id?: string
          id?: string
          optimized_route_url?: string | null
          region_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_routes_delivery_person_id_fkey"
            columns: ["delivery_person_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_routes_dispatch_cycle_id_fkey"
            columns: ["dispatch_cycle_id"]
            isOneToOne: false
            referencedRelation: "dispatch_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_routes_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_stops: {
        Row: {
          arrived_at: string | null
          completed_at: string | null
          created_at: string
          failure_reason: string | null
          id: string
          order_id: string
          route_id: string
          status: string
          stop_order: number
        }
        Insert: {
          arrived_at?: string | null
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          order_id: string
          route_id: string
          status?: string
          stop_order: number
        }
        Update: {
          arrived_at?: string | null
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          order_id?: string
          route_id?: string
          status?: string
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_stops_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_cycles: {
        Row: {
          created_at: string
          cutoff_at: string
          dispatch_date: string
          id: string
          region_id: string
          status: string
        }
        Insert: {
          created_at?: string
          cutoff_at: string
          dispatch_date: string
          id?: string
          region_id: string
          status?: string
        }
        Update: {
          created_at?: string
          cutoff_at?: string
          dispatch_date?: string
          id?: string
          region_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_cycles_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          reference_id: string | null
          reference_type: string | null
          sent_at: string | null
          status: string
          title: string | null
          type: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          reference_id?: string | null
          reference_type?: string | null
          sent_at?: string | null
          status?: string
          title?: string | null
          type: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          reference_id?: string | null
          reference_type?: string | null
          sent_at?: string | null
          status?: string
          title?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_assignments: {
        Row: {
          assigned_quantity: number
          confirmed_at: string | null
          created_at: string
          failure_reason: string | null
          id: string
          order_item_id: string
          platform_margin_frozen: number
          publication_id: string
          status: string
          supplier_id: string
          supplier_price_frozen: number
          updated_at: string
        }
        Insert: {
          assigned_quantity: number
          confirmed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          order_item_id: string
          platform_margin_frozen: number
          publication_id: string
          status?: string
          supplier_id: string
          supplier_price_frozen: number
          updated_at?: string
        }
        Update: {
          assigned_quantity?: number
          confirmed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          order_item_id?: string
          platform_margin_frozen?: number
          publication_id?: string
          status?: string
          supplier_id?: string
          supplier_price_frozen?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_assignments_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_assignments_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "supplier_publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_assignments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          status: string
          subtotal_frozen: number
          unit_price_frozen: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity: number
          status?: string
          subtotal_frozen: number
          unit_price_frozen: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          status?: string
          subtotal_frozen?: number
          unit_price_frozen?: number
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
          cancellation_requested_at: string | null
          cancellation_reason: string | null
          claim_window_expires_at: string | null
          created_at: string
          customer_id: string
          customer_note: string | null
          delivered_at: string | null
          delivery_address: string
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_notes: string | null
          dispatch_cycle_id: string
          grouped_delivery_id: string | null
          id: string
          is_locked: boolean
          locked_at: string | null
          payment_approved_at: string | null
          payment_approved_by: string | null
          payment_method: string | null
          payment_proof_url: string | null
          receipt_type: string | null
          receipt_document: string | null
          receipt_name: string | null
          region_id: string
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          cancellation_requested_at?: string | null
          cancellation_reason?: string | null
          claim_window_expires_at?: string | null
          created_at?: string
          customer_id: string
          customer_note?: string | null
          delivered_at?: string | null
          delivery_address: string
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          dispatch_cycle_id: string
          grouped_delivery_id?: string | null
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          payment_approved_at?: string | null
          payment_approved_by?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          receipt_type?: string | null
          receipt_document?: string | null
          receipt_name?: string | null
          region_id: string
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cancellation_requested_at?: string | null
          cancellation_reason?: string | null
          claim_window_expires_at?: string | null
          created_at?: string
          customer_id?: string
          customer_note?: string | null
          delivered_at?: string | null
          delivery_address?: string
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          dispatch_cycle_id?: string
          grouped_delivery_id?: string | null
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          payment_approved_at?: string | null
          payment_approved_by?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          receipt_type?: string | null
          receipt_document?: string | null
          receipt_name?: string | null
          region_id?: string
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_dispatch_cycle_id_fkey"
            columns: ["dispatch_cycle_id"]
            isOneToOne: false
            referencedRelation: "dispatch_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_approved_by_fkey"
            columns: ["payment_approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_verifications: {
        Row: {
          amount: number
          id: string
          method: string
          order_id: string
          proof_url: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
        }
        Insert: {
          amount: number
          id?: string
          method: string
          order_id: string
          proof_url: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
        }
        Update: {
          amount?: number
          id?: string
          method?: string
          order_id?: string
          proof_url?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_verifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_verifications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          estimated_waste_pct: number
          id: string
          is_active: boolean
          name: string
          operational_cost_pct: number
          slug: string
          suggested_margin_pct: number
        }
        Insert: {
          created_at?: string
          estimated_waste_pct: number
          id?: string
          is_active?: boolean
          name: string
          operational_cost_pct: number
          slug: string
          suggested_margin_pct: number
        }
        Update: {
          created_at?: string
          estimated_waste_pct?: number
          id?: string
          is_active?: boolean
          name?: string
          operational_cost_pct?: number
          slug?: string
          suggested_margin_pct?: number
        }
        Relationships: []
      }
      product_suggestions: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          id: string
          product_name: string
          response_notes: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          use_case: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          product_name: string
          response_notes?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          use_case?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          product_name?: string
          response_notes?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          use_case?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_suggestions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          unit: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          unit: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reception_records: {
        Row: {
          created_at: string
          delivery_person_id: string
          dispatch_cycle_id: string
          expected_quantity: number
          id: string
          photo_url: string
          product_id: string
          received_quantity: number
          recorded_at: string
          rejected_quantity: number
          rejection_reason: string | null
          supplier_id: string
        }
        Insert: {
          created_at?: string
          delivery_person_id: string
          dispatch_cycle_id: string
          expected_quantity: number
          id?: string
          photo_url: string
          product_id: string
          received_quantity: number
          recorded_at?: string
          rejected_quantity?: number
          rejection_reason?: string | null
          supplier_id: string
        }
        Update: {
          created_at?: string
          delivery_person_id?: string
          dispatch_cycle_id?: string
          expected_quantity?: number
          id?: string
          photo_url?: string
          product_id?: string
          received_quantity?: number
          recorded_at?: string
          rejected_quantity?: number
          rejection_reason?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reception_records_delivery_person_id_fkey"
            columns: ["delivery_person_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_records_dispatch_cycle_id_fkey"
            columns: ["dispatch_cycle_id"]
            isOneToOne: false
            referencedRelation: "dispatch_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_records_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          city: string
          country: string
          created_at: string
          department: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          department: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          department?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      reputation_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          exception_reason: string | null
          id: string
          is_exception: boolean
          notes: string | null
          points_delta: number
          reference_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          exception_reason?: string | null
          id?: string
          is_exception?: boolean
          notes?: string | null
          points_delta: number
          reference_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          exception_reason?: string | null
          id?: string
          is_exception?: boolean
          notes?: string | null
          points_delta?: number
          reference_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reputation_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reputation_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_publications: {
        Row: {
          available_quantity: number
          created_at: string
          expires_at: string
          id: string
          minimum_price: number
          product_id: string
          published_at: string
          region_id: string
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          available_quantity: number
          created_at?: string
          expires_at: string
          id?: string
          minimum_price: number
          product_id: string
          published_at?: string
          region_id: string
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          available_quantity?: number
          created_at?: string
          expires_at?: string
          id?: string
          minimum_price?: number
          product_id?: string
          published_at?: string
          region_id?: string
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_publications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_publications_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_publications_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          deleted_at: string | null
          dni: string | null
          email: string
          full_name: string
          id: string
          must_change_password: boolean
          phone: string | null
          region_id: string | null
          reputation_score: number
          role: string
          ruc: string | null
          status: string
          updated_at: string
          wallet_balance: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          dni?: string | null
          email: string
          full_name: string
          id: string
          must_change_password?: boolean
          phone?: string | null
          region_id?: string | null
          reputation_score?: number
          role: string
          ruc?: string | null
          status?: string
          updated_at?: string
          wallet_balance?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          dni?: string | null
          email?: string
          full_name?: string
          id?: string
          must_change_password?: boolean
          phone?: string | null
          region_id?: string | null
          reputation_score?: number
          role?: string
          ruc?: string | null
          status?: string
          updated_at?: string
          wallet_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "users_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          notes: string | null
          proof_url: string | null
          reference_order_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          balance_after: number
          balance_before: number
          created_at?: string
          id?: string
          notes?: string | null
          proof_url?: string | null
          reference_order_id?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          balance_after?: number
          balance_before?: number
          created_at?: string
          id?: string
          notes?: string | null
          proof_url?: string | null
          reference_order_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_reference_order_id_fkey"
            columns: ["reference_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_params: {
        Row: {
          key: string
          value: string
          label: string
          description: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          label: string
          description?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          label?: string
          description?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_params_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          id: string
          order_id: string
          customer_id: string
          type: string
          series: string
          correlative: number
          number: string
          document: string
          customer_name: string
          subtotal: number
          total: number
          issued_at: string
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          customer_id: string
          type: string
          series: string
          correlative: number
          number: string
          document: string
          customer_name: string
          subtotal: number
          total: number
          issued_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          customer_id?: string
          type?: string
          series?: string
          correlative?: number
          number?: string
          document?: string
          customer_name?: string
          subtotal?: number
          total?: number
          issued_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_counters: {
        Row: {
          series: string
          last_number: number
        }
        Insert: {
          series: string
          last_number?: number
        }
        Update: {
          series?: string
          last_number?: number
        }
        Relationships: []
      }
      stock_reservations: {
        Row: {
          id: string
          customer_id: string
          product_id: string
          quantity: number
          expires_at: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          product_id: string
          quantity: number
          expires_at: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          product_id?: string
          quantity?: number
          expires_at?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      catalog_availability: {
        Row: {
          product_id: string
          name: string
          unit: string
          image_url: string | null
          description: string | null
          category_name: string
          total_available: number
          sale_price: number
          nearest_cutoff: string
          region_id: string
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_region_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      next_receipt_correlative: { Args: { p_series: string }; Returns: number }
      decrement_publication_stock: { Args: { p_pub_id: string; p_qty: number }; Returns: number }
      restore_publication_stock: { Args: { p_pub_id: string; p_qty: number }; Returns: number }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

// ─── Enum types ───────────────────────────────────────────────────────────────

export type UserRole = 'superadmin' | 'region_operator' | 'operator' | 'delivery' | 'supplier' | 'customer'
export type UserStatus = 'active' | 'suspended' | 'deleted'
export type OrderStatus = 'pending_payment' | 'payment_submitted' | 'confirmed' | 'assigned' | 'in_transit' | 'delivered' | 'completed' | 'cancelled' | 'failed'
export type PaymentMethod = 'yape' | 'transfer' | 'wallet'
export type ProductUnit = 'kg' | 'unit' | 'liter' | 'bunch'
export type PublicationStatus = 'active' | 'reserved' | 'fulfilled' | 'expired'
export type DispatchCycleStatus = 'open' | 'closed' | 'in_progress' | 'completed'
export type NotificationChannel = 'push' | 'whatsapp' | 'in_app'
export type NotificationStatus = 'pending' | 'sent' | 'failed'
export type ClaimStatus = 'pending' | 'approved' | 'partially_approved' | 'rejected'
export type ResolutionType = 'wallet_credit' | 'external_refund' | 'reprogrammed'
export type WalletTransactionType = 'recharge' | 'payment' | 'refund' | 'bonus' | 'adjustment'
export type WalletTransactionStatus = 'pending' | 'approved' | 'rejected'
export type PaymentVerificationStatus = 'pending' | 'approved' | 'rejected'
export type DeliveryRouteStatus = 'pending' | 'in_progress' | 'completed'
export type DeliveryStopStatus = 'pending' | 'arrived' | 'delivered' | 'failed'
export type OrderItemStatus = 'pending' | 'assigned' | 'delivered' | 'rejected'
export type AssignmentStatus = 'pending' | 'confirmed' | 'shipped' | 'failed'
export type ProductSuggestionStatus = 'pending' | 'reviewing' | 'added' | 'rejected'

// ─── Row type aliases ─────────────────────────────────────────────────────────

type DBTables = Database['public']['Tables']

export type Region              = DBTables['regions']['Row']
export type User                = DBTables['users']['Row']
export type AuditLog            = DBTables['audit_log']['Row']
export type ProductCategory     = DBTables['product_categories']['Row']
export type Product             = DBTables['products']['Row']
export type SupplierPublication = DBTables['supplier_publications']['Row']
export type DispatchCycle       = DBTables['dispatch_cycles']['Row']
export type Order               = DBTables['orders']['Row']
export type OrderItem           = DBTables['order_items']['Row']
export type OrderItemAssignment = DBTables['order_item_assignments']['Row']
export type WalletTransaction   = DBTables['wallet_transactions']['Row']
export type PaymentVerification = DBTables['payment_verifications']['Row']
export type DeliveryRoute       = DBTables['delivery_routes']['Row']
export type DeliveryStop        = DBTables['delivery_stops']['Row']
export type ReceptionRecord     = DBTables['reception_records']['Row']
export type Claim               = DBTables['claims']['Row']
export type ReputationEvent     = DBTables['reputation_events']['Row']
export type Notification        = DBTables['notifications']['Row']
export type ProductSuggestion   = DBTables['product_suggestions']['Row']
export type SystemParam         = DBTables['system_params']['Row']

// ─── Insert type aliases ──────────────────────────────────────────────────────

export type RegionInsert              = DBTables['regions']['Insert']
export type UserInsert                = DBTables['users']['Insert']
export type AuditLogInsert            = DBTables['audit_log']['Insert']
export type ProductCategoryInsert     = DBTables['product_categories']['Insert']
export type ProductInsert             = DBTables['products']['Insert']
export type SupplierPublicationInsert = DBTables['supplier_publications']['Insert']
export type DispatchCycleInsert       = DBTables['dispatch_cycles']['Insert']
export type OrderInsert               = DBTables['orders']['Insert']
export type OrderItemInsert           = DBTables['order_items']['Insert']
export type OrderItemAssignmentInsert = DBTables['order_item_assignments']['Insert']
export type WalletTransactionInsert   = DBTables['wallet_transactions']['Insert']
export type PaymentVerificationInsert = DBTables['payment_verifications']['Insert']
export type DeliveryRouteInsert       = DBTables['delivery_routes']['Insert']
export type DeliveryStopInsert        = DBTables['delivery_stops']['Insert']
export type ReceptionRecordInsert     = DBTables['reception_records']['Insert']
export type ClaimInsert               = DBTables['claims']['Insert']
export type ReputationEventInsert     = DBTables['reputation_events']['Insert']
export type NotificationInsert        = DBTables['notifications']['Insert']
export type ProductSuggestionInsert   = DBTables['product_suggestions']['Insert']
