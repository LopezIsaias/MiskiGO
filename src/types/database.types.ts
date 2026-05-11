export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'superadmin'
  | 'region_operator'
  | 'operator'
  | 'delivery'
  | 'supplier'
  | 'customer'

export type UserStatus = 'active' | 'suspended' | 'deleted'

export type OrderStatus =
  | 'pending_payment'
  | 'payment_submitted'
  | 'confirmed'
  | 'assigned'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'failed'

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

// ─── Database interface (formato Supabase) ────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      regions: {
        Row: {
          id: string
          name: string
          city: string
          department: string
          country: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          city: string
          department: string
          country?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          city?: string
          department?: string
          country?: string
          is_active?: boolean
          created_at?: string
        }
      }

      users: {
        Row: {
          id: string
          email: string
          phone: string | null
          full_name: string
          dni: string | null
          ruc: string | null
          role: UserRole
          region_id: string | null
          reputation_score: number
          status: UserStatus
          wallet_balance: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id: string
          email: string
          phone?: string | null
          full_name: string
          dni?: string | null
          ruc?: string | null
          role: UserRole
          region_id?: string | null
          reputation_score?: number
          status?: UserStatus
          wallet_balance?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          phone?: string | null
          full_name?: string
          dni?: string | null
          ruc?: string | null
          role?: UserRole
          region_id?: string | null
          reputation_score?: number
          status?: UserStatus
          wallet_balance?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }

      // append-only — Update: never
      audit_log: {
        Row: {
          id: string
          timestamp: string
          user_id: string | null
          role_at_time: string
          action: string
          module: string
          region_id: string | null
          entity_type: string | null
          entity_id: string | null
          previous_value: Json | null
          new_value: Json | null
          ip_address: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          timestamp?: string
          user_id?: string | null
          role_at_time: string
          action: string
          module: string
          region_id?: string | null
          entity_type?: string | null
          entity_id?: string | null
          previous_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          notes?: string | null
        }
        Update: never
      }

      product_categories: {
        Row: {
          id: string
          name: string
          slug: string
          operational_cost_pct: number
          suggested_margin_pct: number
          estimated_waste_pct: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          operational_cost_pct: number
          suggested_margin_pct: number
          estimated_waste_pct: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          operational_cost_pct?: number
          suggested_margin_pct?: number
          estimated_waste_pct?: number
          is_active?: boolean
          created_at?: string
        }
      }

      products: {
        Row: {
          id: string
          category_id: string
          name: string
          slug: string
          description: string | null
          unit: ProductUnit
          image_url: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          category_id: string
          name: string
          slug: string
          description?: string | null
          unit: ProductUnit
          image_url?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          category_id?: string
          name?: string
          slug?: string
          description?: string | null
          unit?: ProductUnit
          image_url?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }

      supplier_publications: {
        Row: {
          id: string
          supplier_id: string
          product_id: string
          region_id: string
          available_quantity: number
          minimum_price: number
          published_at: string
          expires_at: string
          status: PublicationStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          product_id: string
          region_id: string
          available_quantity: number
          minimum_price: number
          published_at?: string
          expires_at: string
          status?: PublicationStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          product_id?: string
          region_id?: string
          available_quantity?: number
          minimum_price?: number
          published_at?: string
          expires_at?: string
          status?: PublicationStatus
          created_at?: string
          updated_at?: string
        }
      }

      dispatch_cycles: {
        Row: {
          id: string
          region_id: string
          dispatch_date: string
          cutoff_at: string
          status: DispatchCycleStatus
          created_at: string
        }
        Insert: {
          id?: string
          region_id: string
          dispatch_date: string
          cutoff_at: string
          status?: DispatchCycleStatus
          created_at?: string
        }
        Update: {
          id?: string
          region_id?: string
          dispatch_date?: string
          cutoff_at?: string
          status?: DispatchCycleStatus
          created_at?: string
        }
      }

      orders: {
        Row: {
          id: string
          customer_id: string
          dispatch_cycle_id: string
          region_id: string
          grouped_delivery_id: string | null
          status: OrderStatus
          subtotal: number
          delivery_fee: number
          total_amount: number
          payment_method: PaymentMethod | null
          payment_proof_url: string | null
          payment_approved_at: string | null
          payment_approved_by: string | null
          is_locked: boolean
          locked_at: string | null
          delivery_address: string
          delivery_notes: string | null
          customer_note: string | null
          delivered_at: string | null
          claim_window_expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          dispatch_cycle_id: string
          region_id: string
          grouped_delivery_id?: string | null
          status?: OrderStatus
          subtotal?: number
          delivery_fee?: number
          total_amount?: number
          payment_method?: PaymentMethod | null
          payment_proof_url?: string | null
          payment_approved_at?: string | null
          payment_approved_by?: string | null
          is_locked?: boolean
          locked_at?: string | null
          delivery_address: string
          delivery_notes?: string | null
          customer_note?: string | null
          delivered_at?: string | null
          claim_window_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          dispatch_cycle_id?: string
          region_id?: string
          grouped_delivery_id?: string | null
          status?: OrderStatus
          subtotal?: number
          delivery_fee?: number
          total_amount?: number
          payment_method?: PaymentMethod | null
          payment_proof_url?: string | null
          payment_approved_at?: string | null
          payment_approved_by?: string | null
          is_locked?: boolean
          locked_at?: string | null
          delivery_address?: string
          delivery_notes?: string | null
          customer_note?: string | null
          delivered_at?: string | null
          claim_window_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price_frozen: number
          subtotal_frozen: number
          status: OrderItemStatus
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price_frozen: number
          subtotal_frozen: number
          status?: OrderItemStatus
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price_frozen?: number
          subtotal_frozen?: number
          status?: OrderItemStatus
          created_at?: string
        }
      }

      order_item_assignments: {
        Row: {
          id: string
          order_item_id: string
          publication_id: string
          supplier_id: string
          assigned_quantity: number
          supplier_price_frozen: number
          platform_margin_frozen: number
          status: AssignmentStatus
          confirmed_at: string | null
          failure_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_item_id: string
          publication_id: string
          supplier_id: string
          assigned_quantity: number
          supplier_price_frozen: number
          platform_margin_frozen: number
          status?: AssignmentStatus
          confirmed_at?: string | null
          failure_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_item_id?: string
          publication_id?: string
          supplier_id?: string
          assigned_quantity?: number
          supplier_price_frozen?: number
          platform_margin_frozen?: number
          status?: AssignmentStatus
          confirmed_at?: string | null
          failure_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      // immutable — Update: never
      wallet_transactions: {
        Row: {
          id: string
          user_id: string
          type: WalletTransactionType
          amount: number
          balance_before: number
          balance_after: number
          reference_order_id: string | null
          proof_url: string | null
          status: WalletTransactionStatus
          approved_by: string | null
          approved_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: WalletTransactionType
          amount: number
          balance_before: number
          balance_after: number
          reference_order_id?: string | null
          proof_url?: string | null
          status?: WalletTransactionStatus
          approved_by?: string | null
          approved_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: never
      }

      payment_verifications: {
        Row: {
          id: string
          order_id: string
          method: 'yape' | 'transfer'
          amount: number
          proof_url: string
          status: PaymentVerificationStatus
          submitted_at: string
          reviewed_by: string | null
          reviewed_at: string | null
          rejection_reason: string | null
        }
        Insert: {
          id?: string
          order_id: string
          method: 'yape' | 'transfer'
          amount: number
          proof_url: string
          status?: PaymentVerificationStatus
          submitted_at?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          method?: 'yape' | 'transfer'
          amount?: number
          proof_url?: string
          status?: PaymentVerificationStatus
          submitted_at?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
        }
      }

      delivery_routes: {
        Row: {
          id: string
          delivery_person_id: string
          dispatch_cycle_id: string
          region_id: string
          status: DeliveryRouteStatus
          optimized_route_url: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          delivery_person_id: string
          dispatch_cycle_id: string
          region_id: string
          status?: DeliveryRouteStatus
          optimized_route_url?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          delivery_person_id?: string
          dispatch_cycle_id?: string
          region_id?: string
          status?: DeliveryRouteStatus
          optimized_route_url?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
      }

      delivery_stops: {
        Row: {
          id: string
          route_id: string
          order_id: string
          stop_order: number
          status: DeliveryStopStatus
          arrived_at: string | null
          completed_at: string | null
          failure_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          route_id: string
          order_id: string
          stop_order: number
          status?: DeliveryStopStatus
          arrived_at?: string | null
          completed_at?: string | null
          failure_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          route_id?: string
          order_id?: string
          stop_order?: number
          status?: DeliveryStopStatus
          arrived_at?: string | null
          completed_at?: string | null
          failure_reason?: string | null
          created_at?: string
        }
      }

      reception_records: {
        Row: {
          id: string
          delivery_person_id: string
          dispatch_cycle_id: string
          supplier_id: string
          product_id: string
          expected_quantity: number
          received_quantity: number
          rejected_quantity: number
          rejection_reason: string | null
          photo_url: string
          recorded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          delivery_person_id: string
          dispatch_cycle_id: string
          supplier_id: string
          product_id: string
          expected_quantity: number
          received_quantity: number
          rejected_quantity?: number
          rejection_reason?: string | null
          photo_url: string
          recorded_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          delivery_person_id?: string
          dispatch_cycle_id?: string
          supplier_id?: string
          product_id?: string
          expected_quantity?: number
          received_quantity?: number
          rejected_quantity?: number
          rejection_reason?: string | null
          photo_url?: string
          recorded_at?: string
          created_at?: string
        }
      }

      claims: {
        Row: {
          id: string
          order_id: string
          customer_id: string
          product_id: string
          claimed_quantity: number
          reason: string
          photo_url: string
          status: ClaimStatus
          resolution_type: ResolutionType | null
          resolution_amount: number | null
          resolved_by: string | null
          resolved_at: string | null
          is_justified: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          customer_id: string
          product_id: string
          claimed_quantity: number
          reason: string
          photo_url: string
          status?: ClaimStatus
          resolution_type?: ResolutionType | null
          resolution_amount?: number | null
          resolved_by?: string | null
          resolved_at?: string | null
          is_justified?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          customer_id?: string
          product_id?: string
          claimed_quantity?: number
          reason?: string
          photo_url?: string
          status?: ClaimStatus
          resolution_type?: ResolutionType | null
          resolution_amount?: number | null
          resolved_by?: string | null
          resolved_at?: string | null
          is_justified?: boolean | null
          created_at?: string
        }
      }

      reputation_events: {
        Row: {
          id: string
          user_id: string
          role: string
          event_type: string
          reference_id: string | null
          points_delta: number
          notes: string | null
          is_exception: boolean
          exception_reason: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: string
          event_type: string
          reference_id?: string | null
          points_delta: number
          notes?: string | null
          is_exception?: boolean
          exception_reason?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: string
          event_type?: string
          reference_id?: string | null
          points_delta?: number
          notes?: string | null
          is_exception?: boolean
          exception_reason?: string | null
          created_by?: string | null
          created_at?: string
        }
      }

      notifications: {
        Row: {
          id: string
          recipient_id: string
          type: string
          channel: NotificationChannel
          title: string | null
          body: string
          reference_type: string | null
          reference_id: string | null
          status: NotificationStatus
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          recipient_id: string
          type: string
          channel: NotificationChannel
          title?: string | null
          body: string
          reference_type?: string | null
          reference_id?: string | null
          status?: NotificationStatus
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          recipient_id?: string
          type?: string
          channel?: NotificationChannel
          title?: string | null
          body?: string
          reference_type?: string | null
          reference_id?: string | null
          status?: NotificationStatus
          sent_at?: string | null
          created_at?: string
        }
      }

      product_suggestions: {
        Row: {
          id: string
          customer_id: string
          product_name: string
          description: string | null
          use_case: string | null
          status: ProductSuggestionStatus
          reviewed_by: string | null
          response_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          product_name: string
          description?: string | null
          use_case?: string | null
          status?: ProductSuggestionStatus
          reviewed_by?: string | null
          response_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          product_name?: string
          description?: string | null
          use_case?: string | null
          status?: ProductSuggestionStatus
          reviewed_by?: string | null
          response_notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ─── Row type aliases (para uso cotidiano) ────────────────────────────────────

type Tables = Database['public']['Tables']

export type Region              = Tables['regions']['Row']
export type User                = Tables['users']['Row']
export type AuditLog            = Tables['audit_log']['Row']
export type ProductCategory     = Tables['product_categories']['Row']
export type Product             = Tables['products']['Row']
export type SupplierPublication = Tables['supplier_publications']['Row']
export type DispatchCycle       = Tables['dispatch_cycles']['Row']
export type Order               = Tables['orders']['Row']
export type OrderItem           = Tables['order_items']['Row']
export type OrderItemAssignment = Tables['order_item_assignments']['Row']
export type WalletTransaction   = Tables['wallet_transactions']['Row']
export type PaymentVerification = Tables['payment_verifications']['Row']
export type DeliveryRoute       = Tables['delivery_routes']['Row']
export type DeliveryStop        = Tables['delivery_stops']['Row']
export type ReceptionRecord     = Tables['reception_records']['Row']
export type Claim               = Tables['claims']['Row']
export type ReputationEvent     = Tables['reputation_events']['Row']
export type Notification        = Tables['notifications']['Row']
export type ProductSuggestion   = Tables['product_suggestions']['Row']

// ─── Insert type aliases ──────────────────────────────────────────────────────

export type RegionInsert              = Tables['regions']['Insert']
export type UserInsert                = Tables['users']['Insert']
export type AuditLogInsert            = Tables['audit_log']['Insert']
export type ProductCategoryInsert     = Tables['product_categories']['Insert']
export type ProductInsert             = Tables['products']['Insert']
export type SupplierPublicationInsert = Tables['supplier_publications']['Insert']
export type DispatchCycleInsert       = Tables['dispatch_cycles']['Insert']
export type OrderInsert               = Tables['orders']['Insert']
export type OrderItemInsert           = Tables['order_items']['Insert']
export type OrderItemAssignmentInsert = Tables['order_item_assignments']['Insert']
export type WalletTransactionInsert   = Tables['wallet_transactions']['Insert']
export type PaymentVerificationInsert = Tables['payment_verifications']['Insert']
export type DeliveryRouteInsert       = Tables['delivery_routes']['Insert']
export type DeliveryStopInsert        = Tables['delivery_stops']['Insert']
export type ReceptionRecordInsert     = Tables['reception_records']['Insert']
export type ClaimInsert               = Tables['claims']['Insert']
export type ReputationEventInsert     = Tables['reputation_events']['Insert']
export type NotificationInsert        = Tables['notifications']['Insert']
export type ProductSuggestionInsert   = Tables['product_suggestions']['Insert']
